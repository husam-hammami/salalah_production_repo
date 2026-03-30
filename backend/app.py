import os
import logging
import webbrowser
import json
from flask import Flask, jsonify, request, render_template, redirect, url_for, flash
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from contextlib import closing
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from orders_bp import orders_bp  # Import the test blueprint
from energy import energy_bp # Import energy blueprint
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import pool
from flask import send_from_directory
from psycopg2 import sql
import logging
from orders_bp import get_db_number_for_job_type,write_active_order_to_plc
from flask_socketio import SocketIO, emit
import gevent
import time
import urllib3
import re
import snap7
from snap7.util import get_bool, get_int, get_real, get_dint
http = urllib3.PoolManager()
from scheduler import start_scheduler


logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s %(levelname)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)  # ✅ Send logs to stdout
    ]
)


# Initialize logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# Initialize the Flask application
app = Flask(__name__, static_folder='frontend/dist')
app.secret_key = os.getenv('FLASK_SECRET_KEY', os.urandom(24))
CORS(app,supports_credentials=True, origins=["http://localhost:5000","http://localhost:5173","http://localhost:8080"])  

# Initialize SocketIO with gevent backend
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='gevent')

# 1) Register the blueprint first
app.register_blueprint(orders_bp, url_prefix='/orders')
app.register_blueprint(energy_bp)

# 2) Then define your React catch-all
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')





# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Error handling decorator
def handle_db_errors(f):
    def wrapper_func(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except psycopg2.Error as e:
            logging.error(f"Database error: {e}")
            return jsonify({'error': 'A database error occurred.'}), 500
        except Exception as e:
            logging.error(f"Unexpected error: {e}")
            return jsonify({'error': 'An unexpected error occurred.'}), 500
    wrapper_func.__name__ = f.__name__
    return wrapper_func

       
# Database connection function with default cursor factory
import os

# ✅ OPTIMIZATION: Create connection pool for better performance
class PooledConnection:
    """Wrapper for pooled connection that returns to pool on close"""
    def __init__(self, conn, pool):
        self._conn = conn
        self._pool = pool
        self._closed = False
    
    def __enter__(self):
        return self._conn
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        return False
    
    def close(self):
        if not self._closed and self._pool:
            try:
                self._pool.putconn(self._conn)
                self._closed = True
            except Exception as e:
                logger.warning(f"⚠️ Failed to return connection to pool: {e}")
                self._conn.close()
    
    def __getattr__(self, name):
        return getattr(self._conn, name)

try:
    db_pool = psycopg2.pool.ThreadedConnectionPool(
        minconn=5,  # Minimum connections
        maxconn=20,  # Maximum connections
        dbname=os.getenv('POSTGRES_DB', 'Dynamic_DB_Hercules'),
        user=os.getenv('POSTGRES_USER', 'postgres'),
        password=os.getenv('POSTGRES_PASSWORD', 'trust'),
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', 5432)
    )
    logger.info("✅ Database connection pool created (5-20 connections)")
except Exception as e:
    logger.error(f"❌ Failed to create connection pool: {e}")
    db_pool = None

def get_db_connection():
    """Get connection from pool if available, otherwise create new connection"""
    if db_pool:
        try:
            conn = db_pool.getconn()
            # Set cursor factory for this connection
            conn.cursor_factory = RealDictCursor
            # Return wrapped connection that will return to pool on close
            return PooledConnection(conn, db_pool)
        except Exception as e:
            logger.warning(f"⚠️ Failed to get connection from pool: {e}, creating new connection")
    
    # Fallback: create new connection if pool fails
    conn = psycopg2.connect(
        dbname=os.getenv('POSTGRES_DB', 'Dynamic_DB_Hercules'),
        user=os.getenv('POSTGRES_USER', 'postgres'),
        password=os.getenv('POSTGRES_PASSWORD', 'trust'),
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', 5432),
        cursor_factory=RealDictCursor
    )
    return conn


# User class for Flask-Login
class User(UserMixin):
    def __init__(self, id, username, password_hash, role):
        self.id = id
        self.username = username
        self.password_hash = password_hash
        self.role = role

@login_manager.user_loader
def load_user(user_id):
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()
        # Fetch the user's details along with their role
        cursor.execute(
            'SELECT id, username, password_hash, role FROM users WHERE id = %s', 
            (user_id,)
        )
        user = cursor.fetchone()
        if user:
            # Pass user_role to the User object
            return User(user['id'], user['username'], user['password_hash'], user['role'])
        return None
from flask import make_response
# User authentication routes
@app.route('/login', methods=['POST'])
def login():
    if request.method == 'POST':
        username = request.json.get('username')
        password = request.json.get('password')

        with closing(get_db_connection()) as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT id, username, password_hash, role FROM users WHERE username = %s', (username,))
            user = cursor.fetchone()
            
            if user and check_password_hash(user['password_hash'], password):
                user_obj = User(user['id'], user['username'], user['password_hash'], user['role'])
                login_user(user_obj)

                # ✅ Create a response object
                response = make_response(jsonify({
                    "message": "Login successful",
                    "user_data": {
                        "username": user['username'],
                        "role": user['role']
                    }
                }), 200)

                # ✅ Set authentication token in HTTP-only cookie
                response.set_cookie('auth_token', 'fake_token_here', httponly=True, samesite='Lax')

                return response

            return jsonify({"message": "Invalid username or password"}), 401

@app.route('/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({"message": "You have been logged out successfully"}), 200

@app.route('/check-auth', methods=['GET'])
def check_auth():
    if current_user.is_authenticated:
        return jsonify({
            "authenticated": True,
            "user_data": {
                "id": current_user.id,
                "username": current_user.username,
                "role": getattr(current_user, "role", "N/A")  # Include user role if available
            }
        }), 200
    return jsonify({
        "authenticated": False,
        "message": "User is not authenticated"
    }), 401

# Main index route
@app.route('/')
@login_required
def index():
    return render_template('index.html')

# Users management routes
@app.route('/users', methods=['GET'])
@login_required
@handle_db_errors
def get_users():    
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, username,role FROM users")
        users = cursor.fetchall()
        return jsonify(users)

@app.route('/add-user', methods=['POST'])

@handle_db_errors
def add_user():
    logging.debug("Inside add_user route.")
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    role = data.get('role')

    if not username or not password or not role:
        return jsonify({'error': 'Missing data'}), 400

    password_hash = generate_password_hash(password)

    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT id FROM users WHERE username = %s', (username,))
        if cursor.fetchone():
            return jsonify({'error': 'duplicate'}), 400

        cursor.execute('INSERT INTO users (username, password_hash, role) VALUES (%s, %s, %s)', (username, password_hash,role))
        conn.commit()
    return jsonify({'status': 'success'}), 201

@app.route('/delete-user/<int:user_id>', methods=['DELETE'])
@login_required
@handle_db_errors
def delete_user(user_id):

    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM users WHERE id = %s', (user_id,))
        conn.commit()
    return jsonify({'status': 'success'}), 200

# Materials management routes
@app.route('/materials', methods=['GET'])
@login_required
@handle_db_errors
def get_materials():
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT id, material_name, material_code, category, is_released FROM materials')
        materials = cursor.fetchall()
        return jsonify(materials)

@app.route('/material/<int:material_id>', methods=['GET'])
@login_required
@handle_db_errors
def get_material(material_id):
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT id, material_name, material_code, category, is_released FROM materials WHERE id = %s', (material_id,))
        material = cursor.fetchone()
        if material:
            return jsonify(material)
        return jsonify({'error': 'Material not found'}), 404

@app.route('/add-material', methods=['POST'])
@login_required
@handle_db_errors
def add_material():
    data = request.get_json()    
    logging.debug(f"Received data for add-material: {data}")
    material_name = data.get('materialName')
    material_code = data.get('materialCode')
    category = []

    if data.get('categoryIN'):
        category.append('IN')
    if data.get('categoryOUT'):
        category.append('OUT')

    is_released = data.get('isReleased', False)

    if not material_name or not material_code or not category:
        return jsonify({'error': 'Missing data'}), 400

    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT id FROM materials WHERE material_code = %s', (material_code,))
        if cursor.fetchone():
            return jsonify({'error': 'duplicate'}), 400

        cursor.execute('INSERT INTO materials (material_name, material_code, category, is_released) VALUES (%s, %s, %s, %s)',
                       (material_name, material_code, ','.join(category), is_released))
        conn.commit()
    return jsonify({'status': 'success'}), 201

@app.route('/update-material', methods=['POST'])
@login_required
@handle_db_errors
def update_material():
    data = request.get_json()
    material_id = data.get('materialId')
    material_name = data.get('materialName')
    material_code = data.get('materialCode')

    if not material_id or not material_name or not material_code:
        return jsonify({'error': 'Material Name and Material Code are required.'}), 400

    category = []
    if data.get('categoryIN'):
        category.append('IN')
    if data.get('categoryOUT'):
        category.append('OUT')

    is_released = data.get('isReleased', False)

    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE materials SET material_name = %s, material_code = %s, category = %s, is_released = %s WHERE id = %s',
            (material_name, material_code, ','.join(category), is_released, material_id)
        )
        conn.commit()
    
    return jsonify({'status': 'success'}), 200

@app.route('/delete-material/<int:material_id>', methods=['DELETE'])
@login_required
@handle_db_errors
def delete_material(material_id):
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM materials WHERE id = %s', (material_id,))
        conn.commit()
    return jsonify({'status': 'success'}), 200

# Bins management routes
@app.route('/bins', methods=['GET'])
@login_required
@handle_db_errors
def get_bins():
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT bins.id, bins.bin_name, bins.bin_code, bins.material_id, materials.material_name, materials.material_code
            FROM bins
            LEFT JOIN materials ON bins.material_id = materials.id
            ORDER BY bins.bin_code
        ''')
        bins = cursor.fetchall()
        return jsonify(bins)
    
from orders_bp import connect_to_plc, write_destination_struct

@app.route('/assign-bin', methods=['POST'])
@login_required
@handle_db_errors
def assign_bin():
    raw = request.get_json()
    logger.debug(f"Received data: {raw}")

    if not isinstance(raw, dict) or 'assignments' not in raw:
        return jsonify({'error': 'Invalid request format. Expected key: assignments'}), 400

    assignments = raw['assignments']
    if not isinstance(assignments, list) or not assignments:
        return jsonify({'error': 'Assignments must be a non-empty list'}), 400

    db_number = 1400  # PLC DB block

    # Bin → offset map from Excel
    bin_offset_map = {
        'Bin_021A': 22, 'Bin_021B': 148, 'Bin_021C': 274, 'Bin_0021': 400, 'Bin_0022': 526, 'Bin_0023': 652,
        'Bin_0024': 778, 'Bin_0025': 904, 'Bin_0026': 1030, 'Bin_0027': 1156, 'Bin_0028': 1282,
        'Bin_0029': 1408, 'Bin_0030': 1534, 'Bin_0031': 1660, 'Bin_0032': 1786, 'Bin_0033': 1912,
        'Bin_0034': 2038, 'Bin_0040': 2164, 'Bin_0050': 2290, 'Bin_0051': 2416, 'Bin_0052': 2542,
        'Bin_0053': 2668, 'Bin_0054': 2794, 'Bin_0055': 2920, 'Bin_0056': 3046, 'Bin_0057': 3172,
        'Bin_0060': 3298, 'Bin_0061': 3424, 'Bin_0062': 3550, 'Bin_0070': 3676, 'Bin_0071': 3802,
        'Bin_0081': 3928, 'Bin_0170': 4054, 'Bin_0171': 4180, 'Bin_0921': 4306, 'Bin_0922': 4432,
        'Bin_0923': 4558, 'Bin_0924': 4684
    }

    try:
        with closing(get_db_connection()) as conn:
            cursor = conn.cursor()
            try:
                plc = connect_to_plc()
            except Exception as plc_connect_error:
                logger.error(f"Failed to connect to PLC: {plc_connect_error}")
                return jsonify({'error': 'PLC connection failed'}), 500

            for assignment in assignments:
                bin_id = assignment.get('bin_id')
                material_id = assignment.get('material_id')

                try:
                    bin_id = int(bin_id)
                    material_id = int(material_id)
                except (TypeError, ValueError):
                    return jsonify({'error': f'Invalid bin_id or material_id in {assignment}'}), 400

                # ✅ Fetch actual bin_code from DB
                cursor.execute("SELECT bin_code FROM bins WHERE id = %s", (bin_id,))
                row = cursor.fetchone()
                if not row or not row['bin_code']:
                    return jsonify({'error': f'No bin_code found for bin_id {bin_id}'}), 404

                # Format bin_code with proper padding
                raw_code = row['bin_code'].replace('-', '').strip()
                
                # Check if code ends with a letter (e.g., 21A, 21B, 21C)
                if raw_code and raw_code[-1].isalpha():
                    # Format as 3 digits + letter (e.g., 21A -> 021A)
                    number_part = raw_code[:-1]
                    letter_part = raw_code[-1]
                    formatted_code = f"{number_part.zfill(3)}{letter_part}"
                else:
                    # Format as 4 digits (e.g., 21 -> 0021)
                    formatted_code = raw_code.zfill(4)
                
                bin_code = f"Bin_{formatted_code}"
                offset = bin_offset_map.get(bin_code)
                if offset is None:
                    return jsonify({'error': f'Unknown PLC offset for bin_id {bin_id} (code: {bin_code}, raw: {raw_code})'}), 400

                # Update material_id in DB
                cursor.execute(
                    'UPDATE bins SET material_id = %s WHERE id = %s',
                    (material_id, bin_id)
                )

                # Fetch material details for PLC write
                cursor.execute("""
                    SELECT m.material_name, m.material_code
                    FROM bins b
                    JOIN materials m ON b.material_id = m.id
                    WHERE b.id = %s
                """, (bin_id,))
                mat_row = cursor.fetchone()
                if not mat_row:
                    return jsonify({'error': f'Material not found for bin {bin_id}'}), 404

                destination = {
                    'bin_id': bin_id,
                    'prd_code': int(mat_row['material_code']),
                    'prd_name': mat_row['material_name']
                }

                # ✅ Write to PLC at correct offset
                write_destination_struct(plc, db_number, offset, destination)
                logger.debug(f"PLC write to offset {offset} for bin {bin_code}: {destination}")

            conn.commit()
            plc.disconnect()
            logger.info(f"✅ Bin assignment complete: {len(assignments)} bins written")

            return jsonify({'status': 'success', 'written_count': len(assignments)}), 200

    except Exception as e:
        logger.exception("Unhandled error in assign_bin")
        return jsonify({'error': 'Internal server error during bin assignment'}), 500

@app.route('/unassign-bin/<int:bin_id>', methods=['POST'])
@login_required
@handle_db_errors
def unassign_bin(bin_id):
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute('UPDATE bins SET material_id = NULL WHERE id = %s', (bin_id,))
        conn.commit()
    return jsonify({'status': 'success'}), 200

@app.route('/released-materials', methods=['GET'])
@login_required
@handle_db_errors
def get_released_materials():
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT id, material_name, material_code, category FROM materials WHERE is_released = TRUE')
        materials = cursor.fetchall()
        return jsonify(materials)

# Getting Released Input Ingredients
@app.route('/released-ingredients', methods=['GET'])
@login_required
@handle_db_errors
def get_released_ingredients():
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, material_name, material_code 
            FROM materials 
            WHERE is_released = TRUE 
            AND (category LIKE '%IN%' OR category LIKE '%IN/OUT%')
        ''')
        ingredients = cursor.fetchall()
        return jsonify(ingredients)

# Job management routes
@app.route('/job-types', methods=['GET'])
@login_required
@handle_db_errors
def get_job_types():
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT id, name, description, db_number FROM job_types')  # ✅ Ensure db_number is selected
        job_types = cursor.fetchall()
        return jsonify(job_types)

# Fetch job-specific parameters and recipe data
@app.route('/job-fields/<int:job_type_id>', methods=['GET'])

@handle_db_errors
def get_job_fields(job_type_id):
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()

        # Fetch KPI definitions
        cursor.execute('''
            SELECT id, kpi_name, data_type, default_value, unit
            FROM kpi_definitions
            WHERE job_type_id = %s
        ''', (job_type_id,))
        kpis = cursor.fetchall()

        # Fetch available recipes for this job type
        cursor.execute('SELECT id, name FROM recipes WHERE job_type_id = %s', (job_type_id,))
        recipes = cursor.fetchall()
        for r in recipes:
            r['type'] = 'regular'  # ✅ Add this

        return jsonify({'kpis': kpis, 'recipes': recipes})

# Load a specific recipe and its fields for a job type
@app.route('/load-recipe/<int:recipe_id>', methods=['GET'])

@handle_db_errors
def load_recipe(recipe_id):
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()

        # Fetch the recipe details including final_product_id
        cursor.execute('''
            SELECT id, name, job_type_id, final_product_id, kpis, sources, destinations, description, released
            FROM recipes
            WHERE id = %s
        ''', (recipe_id,))
        recipe = cursor.fetchone()

        if not recipe:
            return jsonify({'error': 'Recipe not found'}), 404

        recipe['type'] = 'regular'  # ✅ Add this
        return jsonify(recipe)

# Add Recipe Route
@app.route('/add-recipe', methods=['POST'])
@login_required
@handle_db_errors
def add_recipe():
    data = request.get_json()
    logging.debug(f"Received data for add-recipe: {data}")

    job_type_id = data.get('jobTypeId')
    recipe_name = data.get('recipeName')
    kpis = data.get('kpis', [])

    # Allow empty KPI lists by checking for None instead of an empty list
    if not job_type_id or not recipe_name or kpis is None:
        return jsonify({'error': 'Missing required data'}), 400

    # Use an empty list as default if kpis is empty
    kpis = kpis if kpis else []

    try:
        with closing(get_db_connection()) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO recipes (job_type_id, name, kpis)
                VALUES (%s, %s, %s::jsonb)
                RETURNING id
            ''', (job_type_id, recipe_name, json.dumps(kpis)))
            recipe_id = cursor.fetchone()['id']
            conn.commit()
            logging.info(f"New recipe added with ID: {recipe_id}")
            return jsonify({'status': 'success', 'recipeId': recipe_id})
    except Exception as e:
        logging.error(f"Unexpected error during recipe addition: {e}")
        return jsonify({'error': 'An unexpected error occurred while adding the recipe.'}), 500





# Update Recipe Route
@app.route('/update-recipe', methods=['POST'])
@login_required
@handle_db_errors
def update_recipe():
    data = request.get_json()
    recipe_id = data.get('recipeId')
    final_product_id = data.get('finalProductId')
    is_released = data.get('is_released')  # Get the is_released field
    kpis = data.get('kpis')
    sources = data.get('sources')
    destinations = data.get('destinations')
    description = data.get('description')  # Expecting JSON

    if not recipe_id or not final_product_id or not kpis:
        return jsonify({'error': 'Missing required data'}), 400

    if is_released is not None and not isinstance(is_released, bool):
        return jsonify({'error': 'is_released must be a boolean'}), 400

    if description is not None and not isinstance(description, dict):
        return jsonify({'error': 'description must be a JSON object'}), 400

    # Convert IDs to integers
    try:
        recipe_id = int(recipe_id)
        final_product_id = int(final_product_id)
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid recipeId or finalProductId'}), 400

    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()

        try:
            cursor.execute('''
                UPDATE recipes
                SET final_product_id = %s, kpis = %s::jsonb, sources = %s::jsonb, destinations = %s::jsonb, description = %s::jsonb, released = %s
                WHERE id = %s
            ''', (final_product_id, json.dumps(kpis), json.dumps(sources), json.dumps(destinations), json.dumps(description), is_released, recipe_id))

            conn.commit()
            logging.info(f"Recipe ID {recipe_id} updated successfully")

            return jsonify({'status': 'success'})

        except Exception as e:
            logging.error(f"Unexpected error during recipe update: {e}")
            conn.rollback()
            return jsonify({'error': 'An unexpected error occurred while updating the recipe.'}), 500


@app.route('/delete-recipe/<int:recipe_id>', methods=['DELETE'])
@login_required
@handle_db_errors
def delete_recipe(recipe_id):
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()

        cursor.execute('DELETE FROM recipes WHERE id = %s', (recipe_id,))

        conn.commit()

    return jsonify({'success': True}), 200

# Release a recipe
@app.route('/release-recipe/<int:recipe_id>', methods=['POST'])
@login_required
@handle_db_errors
def release_recipe(recipe_id):
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()

        # Set the released status to TRUE for the selected recipe
        cursor.execute('UPDATE recipes SET released = TRUE WHERE id = %s', (recipe_id,))
        conn.commit()

    return jsonify({'success': True}), 200

@app.route('/unrelease-recipe/<int:recipe_id>', methods=['POST'])
@login_required
@handle_db_errors
def unrelease_recipe(recipe_id):
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()

        # Set the released status to FALSE for the selected recipe
        cursor.execute('UPDATE recipes SET released = FALSE WHERE id = %s', (recipe_id,))
        conn.commit()

    return jsonify({'success': True}), 200

# Get Released Status
@app.route('/recipe-status/<int:recipe_id>', methods=['GET'])
@login_required
@handle_db_errors
def get_recipe_status(recipe_id):
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT released FROM recipes WHERE id = %s', (recipe_id,))
        recipe = cursor.fetchone()
        if recipe is not None:
            return jsonify({'released': bool(recipe['released'])})
        return jsonify({'error': 'Recipe not found'}), 404

# Create a new order (job)
@app.route('/create-job', methods=['POST'])
@login_required
@handle_db_errors
def create_job():
    data = request.get_json()
    job_type_id = data.get('jobTypeId')
    recipe_id = data.get('recipeId')
    order_name = data.get('orderName')
    kpis = data.get('kpis')
    order_sources = data.get('sources')
    order_destinations = data.get('destinations')

    if not job_type_id or not recipe_id or not kpis or not order_name:
        return jsonify({'error': 'Missing required job data'}), 400

    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()

        # Insert the job into the orders table
        cursor.execute('''
            INSERT INTO orders (job_type_id, recipe_id, order_name, kpis, order_sources, order_destinations)
            VALUES (%s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb)
            RETURNING id
        ''', (job_type_id, recipe_id, order_name, json.dumps(kpis), json.dumps(order_sources), json.dumps(order_destinations)))
        order_id = cursor.fetchone()['id']
        conn.commit()

    # Fetch the dynamic DB number for the job type
    db_number = get_db_number_for_job_type(job_type_id)
    if not db_number:
        return jsonify({'error': 'DB number not found for the given job type'}), 500

    # Prepare destination data for PLC
    formatted_destinations = []
    for dest in order_destinations:
        formatted_destinations.append({
            'selected': dest.get('selected', False),
            'bin_id': int(dest.get('bin_id', 0)),
            'prd_code': int(dest.get('prd_code', 0)),
            'prd_name': str(dest.get('prd_name', ''))
        })

    # Prepare source data for PLC
    formatted_sources = []
    for src in order_sources:
        formatted_sources.append({
            'selected': src.get('selected', False),
            'bin_id': int(src.get('bin_id', 0)),
            'qty_percent': float(src.get('qty_percent', 100.0)),
            'prd_code': int(src.get('prd_code', 0)),
            'prd_name': str(src.get('prd_name', ''))
        })

    # Prepare active order data to send to the PLC
    active_order = {
        'destinations': formatted_destinations,
        'sources': formatted_sources,
        'final_product': recipe_id,
        'kpi_definitions': [],
        'kpis': kpis,
        'stop_options': {'job_qty': True, 'full_dest': False, 'empty_source': True, 'held_status': False}
    }

    try:
        # Send active order to PLC
        write_active_order_to_plc(active_order, db_number)
        return jsonify({'status': 'success', 'orderId': order_id}), 200
    except Exception as e:
        logger.error(f"Failed to send data to PLC: {e}")
        return jsonify({'error': 'Failed to send data to PLC'}), 500



#Modified to include DB number
@app.route('/add-job-type', methods=['POST'])
@login_required
@handle_db_errors
def add_job_type():
    data = request.get_json()
    job_type_name = data.get('jobTypeName')
    job_type_description = data.get('jobTypeDescription', '')
    db_number = data.get('dbNumber')  # Fetch db_number from request

    if not job_type_name or not db_number:
        return jsonify({'error': 'Job Type Name and DB Number are required.'}), 400

    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO job_types (name, description, db_number)
            VALUES (%s, %s, %s)
            RETURNING id
        ''', (job_type_name, job_type_description, db_number))
        job_type_id = cursor.fetchone()['id']
        conn.commit()
    return jsonify({'status': 'success', 'jobTypeId': job_type_id}), 201

# Route to get all job types


import json

# Existing code in main_app.py
from flask import Flask, request, jsonify
from contextlib import closing
import json  # Import json module for serialization
@app.route('/add-kpi-definition', methods=['POST'])
@login_required
@handle_db_errors
def add_kpi_definition():
    data = request.get_json()
    job_type_id = data.get('jobTypeId')
    kpi_name = data.get('kpiName')
    data_type = data.get('kpiDataType')
    default_value = data.get('kpiDefaultValue')
    db_offset = data.get('kpiDbOffset')
    unit = data.get('kpiUnit')  # Existing Field
    read_write = data.get('kpiAccessType', 'RW')  # 'R', 'W', or 'RW'
    bit_value = data.get('bitValue', 0)  # New Field for bit value

    # Validation
    if not job_type_id or not kpi_name or not data_type:
        return jsonify({'error': 'Missing required fields.'}), 400

    # Validate that bit_value is an integer or convertible to integer
    try:
        bit_value = int(bit_value)
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid bit value. It must be an integer.'}), 400

    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO kpi_definitions (job_type_id, kpi_name, data_type, default_value, db_offset, read_write, unit, bit_value)
            VALUES (%s, %s, %s, %s::jsonb, %s, %s, %s, %s)
        ''', (job_type_id, kpi_name, data_type, json.dumps(default_value), db_offset, read_write, unit, bit_value))
        conn.commit()

    return jsonify({'status': 'success'}), 201



@app.route('/get-kpi/<int:kpi_id>', methods=['GET'])
@login_required
@handle_db_errors
def get_kpi(kpi_id):
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, job_type_id, kpi_name, data_type, default_value, db_offset, read_write, unit
            FROM kpi_definitions
            WHERE id = %s
        ''', (kpi_id,))
        kpi = cursor.fetchone()
        if not kpi:
            return jsonify({'error': 'KPI not found'}), 404
        return jsonify(kpi)

@app.route('/update-kpi', methods=['PUT'])
@login_required
@handle_db_errors
def update_kpi():
    data = request.get_json()
    kpi_id = data.get('kpiId')
    kpi_name = data.get('kpiName')
    data_type = data.get('kpiDataType')
    default_value = data.get('kpiDefaultValue')
    db_offset = data.get('kpiDbOffset')
    unit = data.get('kpiUnit')  # New Field
    read_write = data.get('kpiAccessType', 'RW')

    if not kpi_id or not kpi_name:
        return jsonify({'error': 'Missing KPI ID or name'}), 400

    # Convert default_value to JSON
    json_default_value = json.dumps(default_value) if default_value else 'null'
    
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE kpi_definitions
            SET kpi_name = %s,
                data_type = %s,
                default_value = %s::jsonb,
                db_offset = %s,
                read_write = %s,
                unit = %s
            WHERE id = %s
        ''', (kpi_name, data_type, json_default_value, db_offset, read_write, unit, kpi_id))
        if cursor.rowcount == 0:
            return jsonify({'error': 'KPI not found'}), 404
        conn.commit()

    return jsonify({'status': 'success'}), 200

@app.route('/delete-kpi/<int:kpi_id>', methods=['DELETE'])
@login_required
@handle_db_errors
def delete_kpi(kpi_id):
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM kpi_definitions WHERE id = %s', (kpi_id,))
        if cursor.rowcount == 0:
            return jsonify({'error': 'KPI not found'}), 404
        conn.commit()

    return jsonify({'success': True}), 200

@app.route('/kpis/<int:job_type_id>', methods=['GET'])
@login_required
@handle_db_errors
def get_kpis_for_job_type(job_type_id):
    try:
        with closing(get_db_connection()) as conn:
            cursor = conn.cursor()

            # Updated SQL query to explicitly fetch the bit_value field
            query = '''
                SELECT id, kpi_name, data_type, default_value, db_offset, read_write AS access, unit, bit_value
                FROM kpi_definitions
                WHERE job_type_id = %s
            '''
            cursor.execute(query, (job_type_id,))
            kpis = cursor.fetchall()

            # Log the raw fetched KPIs
            print("Raw KPIs from DB:", kpis)

            # Process the KPIs to ensure access and bit_value fields are included
            processed_kpis = []
            for kpi in kpis:
                # Convert the kpi row to a dictionary explicitly
                kpi_dict = dict(kpi)

                # Add the access field if missing or null
                if 'access' not in kpi_dict:
                    kpi_dict['access'] = 'N/A'

                # Add the bit_value field if missing or null
                if 'bit_value' not in kpi_dict:
                    kpi_dict['bit_value'] = 0  # Default bit value

                # Print each KPI to debug
                print("Processed KPI:", kpi_dict)
                processed_kpis.append(kpi_dict)

            return jsonify(processed_kpis)

    except Exception as e:
        logging.error(f"Error fetching KPIs for job_type_id {job_type_id}: {e}")
        return jsonify({'error': 'An error occurred while fetching KPIs'}), 500
@app.route('/get-order/<int:order_id>', methods=['GET'])
@login_required
@handle_db_errors
def get_order(order_id):
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM orders WHERE id = %s', (order_id,))
        order = cursor.fetchone()

        if not order:
            return jsonify({'error': 'Order not found'}), 404

        return jsonify(order)
    
# ---------------------------------------Feeders_recipe API ----------------------------------------------------------------------

@app.route('/feeder-recipes/create', methods=['POST'])
@handle_db_errors
def create_feeder_recipe():
    data = request.get_json()
    job_type_id = data['jobTypeId']
    name = data['recipeName']
    kpis = data.get('kpis', [])
    feeders = data.get('feeders', [])
    final_product_id = data.get('finalProductId')
    description = data.get('description', {})

    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO feeder_recipes (job_type_id, name, kpis, feeders, final_product_id, description)
            VALUES (%s, %s, %s::jsonb, %s::jsonb, %s, %s::jsonb)
            RETURNING id
        ''', (
            job_type_id,
            name,
            json.dumps(kpis),
            json.dumps(feeders),
            final_product_id,
            json.dumps(description)
        ))
        recipe_id = cursor.fetchone()['id']
        conn.commit()

    return jsonify({'status': 'success', 'recipeId': recipe_id}), 201


@app.route('/feeder-recipes/update', methods=['POST'])
@handle_db_errors
def update_feeder_recipe():
    data = request.get_json()
    logging.debug(f"Received data for update_feeder_recipe: {data}")

    # Extract fields
    recipe_id = data.get('recipeId')
    final_product_ids = data.get('final_product_id')  # now expects a list
    is_released = data.get('isReleased', False)
    kpis = data.get('kpis', [])
    feeders = data.get('feeders', [])
    description = data.get('description', {})
    destinations = data.get('destinations', [])

    # ---------- VALIDATION ----------
    if not recipe_id or not final_product_ids or not kpis:
        return jsonify({'error': 'Missing required data'}), 400

    if not isinstance(final_product_ids, list):
        return jsonify({'error': 'final_product_id must be a list of integers'}), 400

    try:
        recipe_id = int(recipe_id)
        final_product_ids = [int(pid) for pid in final_product_ids]
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid recipeId or final_product_id values'}), 400

    if is_released is not None and not isinstance(is_released, bool):
        return jsonify({'error': 'isReleased must be a boolean'}), 400

    if description is not None and not isinstance(description, dict):
        return jsonify({'error': 'description must be a JSON object'}), 400

    if not isinstance(destinations, list):
        return jsonify({'error': 'destinations must be a list'}), 400

    # ---------- DATABASE UPDATE ----------
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()

        try:
            cursor.execute('''
                UPDATE feeder_recipes
                SET final_product_id = %s,
                    kpis = %s::jsonb,
                    feeders = %s::jsonb,
                    destinations = %s::jsonb,
                    description = %s::jsonb,
                    released = %s
                WHERE id = %s
            ''', (
                final_product_ids,
                json.dumps(kpis),
                json.dumps(feeders),
                json.dumps(destinations),
                json.dumps(description),
                is_released,
                recipe_id
            ))

            conn.commit()
            logging.info(f"Feeder recipe ID {recipe_id} updated successfully")
            return jsonify({'status': 'success'}), 200

        except Exception as e:
            logging.error(f"Unexpected error during feeder recipe update: {e}")
            conn.rollback()
            return jsonify({'error': 'An unexpected error occurred while updating the feeder recipe.'}), 500

@app.route('/feeder-recipes/<int:job_type_id>', methods=['GET'])
@login_required
@handle_db_errors
def list_feeder_recipes(job_type_id):
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, name, released FROM feeder_recipes
            WHERE job_type_id = %s
        ''', (job_type_id,))
        recipes = cursor.fetchall()

        # Add 'type' field while still inside the block
        for r in recipes:
            r['type'] = 'feeder'

        return jsonify(recipes)  # still inside the block

@app.route('/feeder-recipes/details/<int:recipe_id>', methods=['GET'])
@handle_db_errors
def get_feeder_recipe_details(recipe_id):
    try:
        with closing(get_db_connection()) as conn:
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

            # 1. Fetch recipe
            cursor.execute('''
                SELECT id, job_type_id, name, kpis, feeders, released,
                       final_product_id, description
                FROM feeder_recipes
                WHERE id = %s
            ''', (recipe_id,))
            recipe = cursor.fetchone()

            if not recipe:
                return jsonify({'error': 'Recipe not found'}), 404

            # 2. Safely parse JSON fields
            for key in ['kpis', 'feeders', 'description']:
                if isinstance(recipe.get(key), str):
                    try:
                        recipe[key] = json.loads(recipe[key])
                    except Exception:
                        recipe[key] = [] if key != 'description' else {}

            # 3. Fetch material map
            cursor.execute("SELECT id, material_name FROM materials")
            material_map = {row['id']: row['material_name'] for row in cursor.fetchall()}

            # 4. Normalize feeders with material name
            enriched_feed = []
            for f in recipe.get('feeders', []):
                material_id = f.get('material_id') or f.get('materialId')
                enriched_feed.append({
                    'materialId': material_id,
                    'percentage': f.get('percentage', 0),
                    'material_name': material_map.get(material_id, 'Unnamed')
                })

            # 5. Return structured response
            return jsonify({
                'id': recipe['id'],
                'job_type_id': recipe['job_type_id'],
                'name': recipe['name'],
                'kpis': recipe.get('kpis', []),
                'feeders': enriched_feed,
                'final_product_id': recipe.get('final_product_id'),
                'description': recipe.get('description', {}),
                'released': recipe.get('released', False),
                'type': 'feeder'
            }), 200

    except Exception as e:
        logging.error(f"Error in get_feeder_recipe_details: {e}")
        return jsonify({'error': 'Unexpected server error'}), 500
    
@app.route('/feeder-recipes/delete/<int:recipe_id>', methods=['DELETE'])
@handle_db_errors
def delete_feeder_recipe(recipe_id):
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()

        # Optional: Check if recipe exists first
        cursor.execute("SELECT id FROM feeder_recipes WHERE id = %s", (recipe_id,))
        if not cursor.fetchone():
            return jsonify({'error': 'Feeder recipe not found'}), 404

        try:
            cursor.execute("DELETE FROM feeder_recipes WHERE id = %s", (recipe_id,))
            conn.commit()
            logging.info(f"Feeder recipe ID {recipe_id} deleted successfully")
            return jsonify({'status': 'success', 'message': f'Recipe {recipe_id} deleted'}), 200
        except Exception as e:
            logging.error(f"Error deleting feeder recipe ID {recipe_id}: {e}")
            conn.rollback()
            return jsonify({'error': 'Failed to delete feeder recipe'}), 500
        
from collections import defaultdict
import json
def archive_old_logs():
    from collections import defaultdict
    import datetime
    import json

    # ✅ Wait until the next hour boundary before starting
    now = datetime.datetime.now()
    next_hour = (now + datetime.timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
    wait_seconds = (next_hour - now).total_seconds()
    logger.info(f"⏰ [FCL Archive] Waiting {wait_seconds:.0f} seconds until {next_hour.strftime('%H:%M:%S')} for first archive run")
    gevent.sleep(wait_seconds)

    while True:
        try:
            with get_db_connection() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    # 1. Select logs before current hour
                    cur.execute("""
                        SELECT * FROM fcl_monitor_logs
                        WHERE created_at < date_trunc('hour', NOW())
                    """)
                    rows = cur.fetchall()

                    if not rows:
                        logger.info("ℹ️ No full-hour FCL logs to archive.")
                        # ✅ Wait until next hour boundary
                        now = datetime.datetime.now()
                        next_hour = (now + datetime.timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
                        wait_seconds = (next_hour - now).total_seconds()
                        logger.info(f"⏰ [FCL Archive] Next check at {next_hour.strftime('%H:%M:%S')}")
                        gevent.sleep(wait_seconds)
                        continue

                    # 2. Build CUMULATIVE per-bin weights (convert t/h → kg for each record)
                    # ✅ Calculate divisor dynamically based on actual record count and time span
                    first_time = min(r.get('created_at') for r in rows if r.get('created_at'))
                    last_time = max(r.get('created_at') for r in rows if r.get('created_at'))
                    time_span_seconds = (last_time - first_time).total_seconds()
                    
                    # Calculate actual divisor: how many records per hour?
                    # divisor = (number of records / time span in hours) = records per hour
                    if time_span_seconds > 0:
                        time_span_hours = time_span_seconds / 3600
                        actual_divisor = len(rows) / time_span_hours
                    else:
                        actual_divisor = 1200  # Fallback to 3-second assumption
                    
                    logger.info(f"📊 [FCL Archive] Time span: {time_span_seconds:.0f}s | Records: {len(rows)} | Divisor: {actual_divisor:.0f} (records/hour)")
                    
                    bin_cumulative = defaultdict(float)
                    receiver_cumulative_kg = 0.0
                    water_cumulative_liters = 0.0  # ✅ Sum water rate (l/h) over hour → total liters (same method as receiver)

                    for row in rows:
                        sources = row.get('active_sources', [])
                        if isinstance(sources, str):
                            sources = json.loads(sources)
                        
                        # ✅ Convert each sender's flow rate (t/h) to kg per record using ACTUAL divisor
                        for src in sources:
                            bin_id = src.get('bin_id')
                            weight_tph = float(src.get('weight', 0))  # t/h
                            kg_per_record = weight_tph * 1000 / actual_divisor  # ✅ Dynamic divisor!
                            bin_cumulative[bin_id] += kg_per_record  # Accumulate kg
                        
                        # ✅ Convert receiver flow rate (t/h) to kg per record using ACTUAL divisor
                        receiver_tph = float(row.get('receiver', 0) or 0)  # t/h (flow rate only, not cumulative)
                        receiver_kg_per_record = receiver_tph * 1000 / actual_divisor  # ✅ Dynamic divisor!
                        receiver_cumulative_kg += receiver_kg_per_record

                        # ✅ Convert water flow rate (l/h) to liters per record; sum → total liters for the hour
                        water_lh = float(row.get('water_consumed', 0) or 0)  # l/h (stored as rate in live table)
                        liters_per_record = water_lh / actual_divisor  # same method as receiver
                        water_cumulative_liters += liters_per_record

                    # Store cumulative kg for each bin
                    per_bin_json = json.dumps([
                        {"bin_id": k, "total_weight": round(v, 3)}  # kg
                        for k, v in bin_cumulative.items()
                    ])
                    
                    # Total produced = sum of all sender bins (kg) + receiver flow (kg)
                    total_bin_weight_kg = sum(bin_cumulative.values())
                    produced_weight = round(total_bin_weight_kg + receiver_cumulative_kg, 3)
                    
                    # ✅ Find latest record by timestamp (most reliable method)
                    latest = max(rows, key=lambda r: r.get('created_at') or datetime.datetime.min)

                    # ✅ Archive order_name: use last non-null order_name in the hour (by created_at), not just latest
                    # so the hour gets the order that was running even if the last second was idle (job_status=0)
                    rows_sorted = sorted(rows, key=lambda r: r.get('created_at') or datetime.datetime.min)
                    rows_with_order = [r for r in rows_sorted if r.get('order_name') and str(r.get('order_name')).strip()]
                    archive_order_name = rows_with_order[-1]['order_name'] if rows_with_order else latest.get('order_name')

                    # ✅ Extract FCL_2_520WE directly from the LATEST record (most recent timestamp)
                    # This is more reliable than relying on loop order
                    fcl_2_520we_last = 0
                    latest_fcl_receivers = latest.get('fcl_receivers', [])
                    if isinstance(latest_fcl_receivers, str):
                        latest_fcl_receivers = json.loads(latest_fcl_receivers)
                    
                    # ✅ Get FCL_2_520WE value from the latest record (most recent timestamp)
                    for rec in latest_fcl_receivers:
                        if rec.get('id') == 'FCL_2_520WE':
                            fcl_2_520we_last = float(rec.get('weight', 0))  # Already in kg
                            break  # Found it, no need to continue
                    
                    # ✅ Fallback: If not found in latest record, scan all records and take maximum
                    # This handles edge cases where latest record might not have FCL_2_520WE
                    if fcl_2_520we_last == 0:
                        for row in rows:
                            fcl_receivers = row.get('fcl_receivers', [])
                            if isinstance(fcl_receivers, str):
                                fcl_receivers = json.loads(fcl_receivers)
                            for rec in fcl_receivers:
                                if rec.get('id') == 'FCL_2_520WE':
                                    weight = float(rec.get('weight', 0))
                                    if weight > fcl_2_520we_last:  # Take the maximum (should be latest)
                                        fcl_2_520we_last = weight
                    
                    logger.info(f"📦 [FCL Archive] Records: {len(rows)} | Senders: {total_bin_weight_kg:.1f} kg | Receiver: {receiver_cumulative_kg:.1f} kg | Water: {water_cumulative_liters:.1f} L | Total: {produced_weight:.1f} kg | FCL_2_520WE (last value): {fcl_2_520we_last:.0f} kg")

                    # ✅ Use Dubai timezone for archive timestamp
                    import pytz
                    from datetime import datetime as dt
                    dubai_tz = pytz.timezone('Asia/Dubai')
                    archive_time = dt.now(pytz.utc).astimezone(dubai_tz).replace(tzinfo=None)

                    # 3. Insert archive summary
                    cur.execute("""
                        CREATE TABLE IF NOT EXISTS fcl_monitor_logs_archive (
                            id SERIAL PRIMARY KEY,
                            job_status INT,
                            line_running BOOLEAN,
                            receiver NUMERIC,
                            fcl_receivers JSONB,
                            flow_rate NUMERIC,
                            produced_weight NUMERIC,
                            water_consumed NUMERIC,
                            moisture_offset NUMERIC,
                            moisture_setpoint NUMERIC,
                            active_sources JSONB,
                            active_destination JSONB,
                            order_name TEXT,
                            per_bin_weights JSONB,
                            created_at TIMESTAMP
                        );
                    """)
                    # ✅ FCL_2_520WE: Store LAST value (not summed!)
                    # This is a cumulative counter from PLC (already in kg)
                    # We just store the final reading from the last record of the hour
                    
                    # Update FCL_2_520WE to the LAST cumulative value (not summed over the hour!)
                    for rec in latest_fcl_receivers:
                        if rec.get('id') == 'FCL_2_520WE':
                            rec['weight'] = fcl_2_520we_last  # Just the last value, already in kg
                    
                    cur.execute("""
                        INSERT INTO fcl_monitor_logs_archive (
                            job_status, line_running, receiver, fcl_receivers, flow_rate, produced_weight,
                            water_consumed, moisture_offset, moisture_setpoint, cleaning_scale_bypass,
                            active_sources, active_destination, order_name,
                            per_bin_weights, created_at
                        )
                        VALUES (%s, %s, %s, %s::jsonb, %s, %s, %s, %s, %s, %s,
                                %s::jsonb, %s::jsonb, %s,
                                %s::jsonb, %s)
                    """, (
                        latest['job_status'],
                        latest['line_running'],
                        round(receiver_cumulative_kg, 3),  # ✅ Cumulative kg, not summed t/h
                        json.dumps(latest_fcl_receivers),  # ✅ Include updated FCL_2_520WE counter
                        latest['flow_rate'],
                        produced_weight,  # ✅ Total cumulative kg (senders + receiver)
                        round(water_cumulative_liters, 3),  # ✅ Total liters for the hour (sum of rate l/h over hour, same method as receiver)
                        latest['moisture_offset'],
                        latest['moisture_setpoint'],
                        latest.get('cleaning_scale_bypass', False), # ✅ New field
                        json.dumps(latest['active_sources']),
                        json.dumps(latest['active_destination']),
                        archive_order_name,  # ✅ Last non-null order_name in hour (not just latest row)
                        per_bin_json,  # ✅ Per-bin cumulative kg
                        archive_time  # ✅ Explicit Dubai timezone timestamp
                    ))

                    # 4. Now safely delete the logs that were archived
                    cur.execute("""
                        DELETE FROM fcl_monitor_logs
                        WHERE created_at < date_trunc('hour', NOW())
                    """)
                    conn.commit()

                    logger.info(f"✅ FCL archive inserted and {len(rows)} logs deleted. | Archive Time: {archive_time}")

        except Exception as e:
            logger.error(f"❌ Archive failed: {e}", exc_info=True)

        # ✅ Wait until the next hour boundary (not just 3600 seconds)
        now = datetime.datetime.now()
        next_hour = (now + datetime.timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
        wait_seconds = (next_hour - now).total_seconds()
        logger.info(f"⏰ [FCL Archive] Next archive at {next_hour.strftime('%H:%M:%S')} (sleeping {wait_seconds:.0f} seconds)")
        gevent.sleep(wait_seconds)

def archive_old_scl_logs():
    from collections import defaultdict
    import json
    import datetime

    # ✅ Wait until the next hour boundary before starting
    now = datetime.datetime.now()
    next_hour = (now + datetime.timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
    wait_seconds = (next_hour - now).total_seconds()
    logger.info(f"⏰ [SCL Archive] Waiting {wait_seconds:.0f} seconds until {next_hour.strftime('%H:%M:%S')} for first archive run")
    gevent.sleep(wait_seconds)

    while True:
        try:
            with get_db_connection() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    # ✅ Use Dubai timezone for archive timestamp
                    import pytz
                    from datetime import datetime as dt
                    dubai_tz = pytz.timezone('Asia/Dubai')
                    archive_time = dt.now(pytz.utc).astimezone(dubai_tz).replace(tzinfo=None)

                    # 1. Ensure archive table exists
                    cur.execute("""
                        CREATE TABLE IF NOT EXISTS scl_monitor_logs_archive (
                            id SERIAL PRIMARY KEY,
                            job_status INT,
                            line_running BOOLEAN,
                            receiver NUMERIC,
                            flow_rate NUMERIC,
                            produced_weight NUMERIC,
                            water_consumed NUMERIC,
                            moisture_offset NUMERIC,
                            moisture_setpoint NUMERIC,
                            active_sources JSONB,
                            active_destination JSONB,
                            order_name TEXT,
                            per_bin_weights JSONB,
                            created_at TIMESTAMP
                        );
                    """)

                    # 2. SELECT ONLY — do not delete yet
                    cur.execute("""
                        SELECT *
                        FROM scl_monitor_logs
                        WHERE created_at < date_trunc('hour', NOW())
                    """)
                    rows = cur.fetchall()

                    if not rows:
                        logger.info("ℹ️ No full-hour SCL logs to archive.")
                        # ✅ Wait until next hour boundary
                        now = datetime.datetime.now()
                        next_hour = (now + datetime.timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
                        wait_seconds = (next_hour - now).total_seconds()
                        logger.info(f"⏰ [SCL Archive] Next check at {next_hour.strftime('%H:%M:%S')}")
                        gevent.sleep(wait_seconds)
                        continue

                    # 3. Build CUMULATIVE per-bin weights (convert t/h → kg for each record)
                    # ✅ Calculate divisor dynamically based on actual record count and time span
                    first_time = min(r.get('created_at') for r in rows if r.get('created_at'))
                    last_time = max(r.get('created_at') for r in rows if r.get('created_at'))
                    time_span_seconds = (last_time - first_time).total_seconds()
                    
                    # Calculate actual divisor based on records per hour
                    if time_span_seconds > 0:
                        time_span_hours = time_span_seconds / 3600
                        actual_divisor = len(rows) / time_span_hours
                    else:
                        actual_divisor = 1200  # Fallback
                    
                    logger.info(f"📊 [SCL Archive] Time span: {time_span_seconds:.0f}s | Records: {len(rows)} | Divisor: {actual_divisor:.0f} (records/hour)")
                    
                    bin_cumulative = defaultdict(float)
                    receiver_cumulative_kg = 0.0

                    for row in rows:
                        sources = row.get('active_sources', [])
                        if isinstance(sources, str):
                            sources = json.loads(sources)

                        # ✅ Convert each sender's flow rate (t/h) to kg per record using ACTUAL divisor
                        for src in sources:
                            bin_id = src.get('bin_id')
                            flowrate_tph = float(src.get('flowrate_tph', 0))  # t/h
                            kg_per_record = flowrate_tph * 1000 / actual_divisor  # ✅ Dynamic divisor!
                            bin_cumulative[bin_id] += kg_per_record  # Accumulate kg
                            logger.debug(f"[SCL Archive] bin_id={bin_id}, flowrate={flowrate_tph} t/h → {kg_per_record:.3f} kg/record")

                        # ✅ Convert receiver flow rate (t/h) to kg per record using ACTUAL divisor
                        receiver_tph = float(row.get('receiver') or 0)  # t/h
                        receiver_kg_per_record = receiver_tph * 1000 / actual_divisor  # ✅ Dynamic divisor!
                        receiver_cumulative_kg += receiver_kg_per_record

                    # 4. Store cumulative kg for each bin
                    per_bin_json = json.dumps([
                        {"bin_id": k, "total_weight": round(v, 3)}  # kg
                        for k, v in bin_cumulative.items()
                    ])

                    # Total produced = receiver flow (kg) (which matches sender flow)
                    total_bin_weight_kg = sum(bin_cumulative.values())
                    
                    # ✅ Force receiver to match sender total (Input = Output) for consistency
                    receiver_cumulative_kg = total_bin_weight_kg
                    
                    produced_weight = round(receiver_cumulative_kg, 3)

                    # ✅ Safety Check: Max capacity 24,000 kg/hour
                    if produced_weight > 24000:
                         logger.warning(f"⚠️ [SCL Archive] Produced weight {produced_weight} kg > 24000 kg! Capping at 24000.")
                         produced_weight = 24000
                    
                    logger.info(f"📦 [SCL Archive] Records: {len(rows)} | Senders: {total_bin_weight_kg:.1f} kg | Receiver: {receiver_cumulative_kg:.1f} kg | Produced (Capped): {produced_weight:.1f} kg")

                    # 5. Use latest record metadata
                    latest = max(rows, key=lambda r: r.get('created_at') or datetime.datetime.min)

                    # 6. Insert into archive with cumulative kg values
                    cur.execute("""
                        INSERT INTO scl_monitor_logs_archive (
                            job_status, line_running, receiver, flow_rate, produced_weight,
                            water_consumed, moisture_offset, moisture_setpoint,
                            active_sources, active_destination, order_name,
                            per_bin_weights, created_at
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s,
                                %s::jsonb, %s::jsonb, %s,
                                %s::jsonb, %s)
                    """, (
                        latest['job_status'],
                        latest['line_running'],
                        round(receiver_cumulative_kg, 3),  # ✅ Cumulative kg, not summed t/h
                        latest['flow_rate'],
                        produced_weight,  # ✅ Total cumulative kg (senders + receiver)
                        latest['water_consumed'],
                        latest['moisture_offset'],
                        latest['moisture_setpoint'],
                        json.dumps(latest['active_sources']),
                        json.dumps(latest['active_destination']),
                        latest['order_name'],
                        per_bin_json,  # ✅ Per-bin cumulative kg
                        archive_time  # ✅ Explicit Dubai timezone timestamp
                    ))

                    # 7. Delete only now that insert is done
                    cur.execute("""
                        DELETE FROM scl_monitor_logs
                        WHERE created_at < date_trunc('hour', NOW())
                    """)

                    conn.commit()
                    logger.info(f"✅ SCL archive inserted. {len(rows)} rows archived and deleted from live table. | Archive Time: {archive_time}")

        except Exception as e:
            logger.error(f"❌ Archive SCL failed: {e}", exc_info=True)

        # ✅ Wait until the next hour boundary (not just 3600 seconds)
        now = datetime.datetime.now()
        next_hour = (now + datetime.timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
        wait_seconds = (next_hour - now).total_seconds()
        logger.info(f"⏰ [SCL Archive] Next archive at {next_hour.strftime('%H:%M:%S')} (sleeping {wait_seconds:.0f} seconds)")
        gevent.sleep(wait_seconds)

def archive_old_ftra_logs():
    from collections import defaultdict
    import json
    import datetime

    # ✅ Wait until the next hour boundary before starting
    now = datetime.datetime.now()
    next_hour = (now + datetime.timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
    wait_seconds = (next_hour - now).total_seconds()
    logger.info(f"⏰ [FTRA Archive] Waiting {wait_seconds:.0f} seconds until {next_hour.strftime('%H:%M:%S')} for first archive run")
    gevent.sleep(wait_seconds)

    while True:
        try:
            with get_db_connection() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    # ✅ Use Dubai timezone for archive timestamp
                    import pytz
                    from datetime import datetime as dt
                    dubai_tz = pytz.timezone('Asia/Dubai')
                    archive_time = dt.now(pytz.utc).astimezone(dubai_tz).replace(tzinfo=None)

                    # 1. Ensure archive table exists
                    cur.execute("""
                        CREATE TABLE IF NOT EXISTS ftra_monitor_logs_archive (
                            id SERIAL PRIMARY KEY,
                            receiver_bin_id INT,
                            sender_1_bin_id INT,
                            sender_2_bin_id INT,
                            feeder_3_target NUMERIC,
                            feeder_3_selected BOOLEAN,
                            feeder_4_target NUMERIC,
                            feeder_4_selected BOOLEAN,
                            feeder_5_target NUMERIC,
                            feeder_5_selected BOOLEAN,
                            feeder_6_target NUMERIC,
                            feeder_6_selected BOOLEAN,
                            speed_discharge_50 NUMERIC,
                            speed_discharge_51_55 NUMERIC,
                            bag_collection BOOLEAN,
                            mixing_screw BOOLEAN,
                            line_running BOOLEAN,
                            receiver_weight NUMERIC,
                            produced_weight NUMERIC,
                            active_sources JSONB,
                            order_name TEXT,
                            per_bin_weights JSONB,
                            created_at TIMESTAMP
                        );
                    """)

                    # 2. SELECT ONLY — do not delete yet
                    cur.execute("""
                        SELECT *
                        FROM ftra_monitor_logs
                        WHERE created_at < date_trunc('hour', NOW())
                    """)
                    rows = cur.fetchall()

                    if not rows:
                        logger.info("ℹ️ No full-hour FTRA logs to archive.")
                        # ✅ Wait until next hour boundary
                        now = datetime.datetime.now()
                        next_hour = (now + datetime.timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
                        wait_seconds = (next_hour - now).total_seconds()
                        logger.info(f"⏰ [FTRA Archive] Next check at {next_hour.strftime('%H:%M:%S')}")
                        gevent.sleep(wait_seconds)
                        continue

                    # 3. Build CUMULATIVE per-bin weights (convert t/h → kg for each record)
                    first_time = min(r.get('created_at') for r in rows if r.get('created_at'))
                    last_time = max(r.get('created_at') for r in rows if r.get('created_at'))
                    time_span_seconds = (last_time - first_time).total_seconds()
                    
                    # Calculate actual divisor based on records per hour
                    if time_span_seconds > 0:
                        time_span_hours = time_span_seconds / 3600
                        actual_divisor = len(rows) / time_span_hours
                    else:
                        actual_divisor = 1200  # Fallback
                    
                    logger.info(f"📊 [FTRA Archive] Time span: {time_span_seconds:.0f}s | Records: {len(rows)} | Divisor: {actual_divisor:.0f} (records/hour)")
                    
                    bin_cumulative = defaultdict(float)
                    receiver_cumulative_kg = 0.0

                    for row in rows:
                        sources = row.get('active_sources', [])
                        if isinstance(sources, str):
                            sources = json.loads(sources)

                        # ✅ Convert each sender's flow rate (t/h) to kg per record using ACTUAL divisor
                        for src in sources:
                            bin_id = src.get('bin_id')
                            weight_tph = float(src.get('weight', 0))  # t/h
                            kg_per_record = weight_tph * 1000 / actual_divisor
                            bin_cumulative[bin_id] += kg_per_record
                            logger.debug(f"[FTRA Archive] bin_id={bin_id}, weight={weight_tph} t/h → {kg_per_record:.3f} kg/record")

                        # ✅ Convert receiver flow rate (t/h) to kg per record using ACTUAL divisor
                        receiver_tph = float(row.get('receiver_weight') or 0)  # t/h
                        receiver_kg_per_record = receiver_tph * 1000 / actual_divisor
                        receiver_cumulative_kg += receiver_kg_per_record

                    # 4. Store cumulative kg for each bin
                    per_bin_json = json.dumps([
                        {"bin_id": k, "total_weight": round(v, 3)}  # kg
                        for k, v in bin_cumulative.items()
                    ])

                    # Total produced = receiver flow (kg) (which matches sender flow)
                    total_bin_weight_kg = sum(bin_cumulative.values())
                    
                    # ✅ Force receiver to match sender total (Input = Output) for consistency
                    receiver_cumulative_kg = total_bin_weight_kg
                    
                    produced_weight = round(receiver_cumulative_kg, 3)

                    # ✅ Safety Check: Max capacity 24,000 kg/hour
                    if produced_weight > 24000:
                        logger.warning(f"⚠️ [FTRA Archive] Produced weight {produced_weight} kg > 24000 kg! Capping at 24000.")
                        produced_weight = 24000
                    
                    logger.info(f"📦 [FTRA Archive] Records: {len(rows)} | Senders: {total_bin_weight_kg:.1f} kg | Receiver: {receiver_cumulative_kg:.1f} kg | Produced (Capped): {produced_weight:.1f} kg")

                    # 5. Use latest record metadata
                    latest = max(rows, key=lambda r: r.get('created_at') or datetime.datetime.min)

                    # 6. Insert into archive with cumulative kg values
                    cur.execute("""
                        INSERT INTO ftra_monitor_logs_archive (
                            receiver_bin_id, sender_1_bin_id, sender_2_bin_id,
                            feeder_3_target, feeder_3_selected,
                            feeder_4_target, feeder_4_selected,
                            feeder_5_target, feeder_5_selected,
                            feeder_6_target, feeder_6_selected,
                            speed_discharge_50, speed_discharge_51_55,
                            bag_collection, mixing_screw,
                            line_running, receiver_weight, produced_weight,
                            active_sources, order_name, per_bin_weights, created_at
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s::jsonb, %s)
                    """, (
                        latest['receiver_bin_id'],
                        latest['sender_1_bin_id'],
                        latest['sender_2_bin_id'],
                        latest['feeder_3_target'],
                        latest['feeder_3_selected'],
                        latest['feeder_4_target'],
                        latest['feeder_4_selected'],
                        latest['feeder_5_target'],
                        latest['feeder_5_selected'],
                        latest['feeder_6_target'],
                        latest['feeder_6_selected'],
                        latest['speed_discharge_50'],
                        latest['speed_discharge_51_55'],
                        latest['bag_collection'],
                        latest['mixing_screw'],
                        latest['line_running'],
                        round(receiver_cumulative_kg, 3),
                        produced_weight,
                        json.dumps(latest['active_sources']),
                        latest['order_name'],
                        per_bin_json,
                        archive_time
                    ))

                    # 7. Delete only now that insert is done
                    cur.execute("""
                        DELETE FROM ftra_monitor_logs
                        WHERE created_at < date_trunc('hour', NOW())
                    """)

                    conn.commit()
                    logger.info(f"✅ FTRA archive inserted. {len(rows)} rows archived and deleted from live table. | Archive Time: {archive_time}")

        except Exception as e:
            logger.error(f"❌ Archive FTRA failed: {e}", exc_info=True)

        # ✅ Wait until the next hour boundary (not just 3600 seconds)
        now = datetime.datetime.now()
        next_hour = (now + datetime.timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
        wait_seconds = (next_hour - now).total_seconds()
        logger.info(f"⏰ [FTRA Archive] Next archive at {next_hour.strftime('%H:%M:%S')} (sleeping {wait_seconds:.0f} seconds)")
        gevent.sleep(wait_seconds)

def archive_mila_logs():
    import json
    from collections import defaultdict
    import datetime

    # ✅ Wait until the next 30-minute boundary before starting
    now = datetime.datetime.now()
    # Calculate next 30-minute boundary (00:00, 00:30, 01:00, 01:30, etc.)
    if now.minute < 30:
        next_boundary = now.replace(minute=30, second=0, microsecond=0)
    else:
        next_boundary = (now + datetime.timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
    wait_seconds = (next_boundary - now).total_seconds()
    logger.info(f"⏰ [MILA Archive] Waiting {wait_seconds:.0f} seconds until {next_boundary.strftime('%H:%M:%S')} for first archive run")
    gevent.sleep(wait_seconds)

    while True:
        try:
            with get_db_connection() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    # ✅ Use Dubai timezone for archive timestamp
                    import pytz
                    from datetime import datetime as dt
                    dubai_tz = pytz.timezone('Asia/Dubai')
                    archive_time = dt.now(pytz.utc).astimezone(dubai_tz).replace(tzinfo=None)

                    # 1. Ensure archive table exists (main table for reports)
                    cur.execute("""
                        CREATE TABLE IF NOT EXISTS mila_monitor_logs_archive (
                            id SERIAL PRIMARY KEY,
                            order_name TEXT,
                            status TEXT,
                            receiver JSONB,
                            bran_receiver JSONB,
                            yield_log JSONB,
                            setpoints_produced JSONB,
                            produced_weight NUMERIC,
                            created_at TIMESTAMP
                        );
                    """)

                    # 2. Calculate the 30-minute period boundary for archiving
                    # ✅ Use Dubai timezone for archive cutoff since created_at is stored in Dubai time
                    import pytz
                    dubai_tz = pytz.timezone('Asia/Dubai')
                    now_dubai = datetime.datetime.now(dubai_tz)
                    
                    # Calculate current 30-minute boundary
                    if now_dubai.minute < 30:
                        current_period_start = now_dubai.replace(minute=0, second=0, microsecond=0, tzinfo=None)
                    else:
                        current_period_start = now_dubai.replace(minute=30, second=0, microsecond=0, tzinfo=None)
                    
                    # Archive cutoff: everything BEFORE the current period start
                    # This ensures we archive the previous 30-minute period
                    archive_cutoff = current_period_start
                    
                    logger.info(f"📊 [MILA Archive] Current Dubai time: {now_dubai.strftime('%Y-%m-%d %H:%M:%S')}")
                    logger.info(f"📊 [MILA Archive] Archive cutoff: {archive_cutoff} (will archive all data < this timestamp)")
                    
                    # 3. ✅ STEP 1: SELECT data from live table (mila_monitor_logs) to archive
                    # Query records from the previous 30-minute period (before current period start)
                    cur.execute("""
                        SELECT *
                        FROM mila_monitor_logs
                        WHERE created_at < %s
                        ORDER BY created_at ASC
                    """, (archive_cutoff,))
                    rows = cur.fetchall()
                    
                    logger.info(f"📊 [MILA Archive] Found {len(rows)} rows in live table to move to archive (created_at < {archive_cutoff})")

                    if not rows:
                        logger.info("ℹ️ No MILA logs to archive.")
                        # ✅ Wait until next 30-minute boundary
                        now = datetime.datetime.now()
                        if now.minute < 30:
                            next_boundary = now.replace(minute=30, second=0, microsecond=0)
                        else:
                            next_boundary = (now + datetime.timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
                        wait_seconds = (next_boundary - now).total_seconds()
                        logger.info(f"⏰ [MILA Archive] Next check at {next_boundary.strftime('%H:%M:%S')}")
                        gevent.sleep(wait_seconds)
                        continue

                    count = len(rows)
                    
                    # ✅ Log time range of data being archived
                    if rows:
                        first_time = rows[0].get('created_at')
                        last_time = rows[-1].get('created_at')
                        logger.info(f"📊 [MILA Archive] Moving data from live table: {first_time} to {last_time}")

                    # 4. Process the data for archiving (aggregation logic)
                    # 3. Max/Min flow
                    max_flow = max(r['yield_log'].get("Yield Max Flow (kg/s)", 0) for r in rows)
                    min_flow = min(r['yield_log'].get("Yield Min Flow (kg/s)", 0) for r in rows)

                    # 4. Average yield %
                    avg_yield_pct = defaultdict(float)
                    yield_pct_keys = set()
                    
                    # Track MILA_Flour1 sum separately if it appears in yield_log (legacy support)
                    mila_flour1_sum = 0.0
                    
                    for r in rows:
                        for k, v in r['yield_log'].items():
                            # Special handling for MILA_Flour1 if it exists in yield_log
                            if "MILA_Flour1" in k:
                                if isinstance(v, (int, float)):
                                    mila_flour1_sum += v
                                continue
                                
                            if isinstance(v, (int, float)) and "%" in k:
                                avg_yield_pct[k] += v
                                yield_pct_keys.add(k)
                    for k in yield_pct_keys:
                        avg_yield_pct[k] = round(avg_yield_pct[k] / count, 3)

                    # 5. Average setpoints % and numeric values (t/h, etc.)
                    avg_setpoints_numeric = defaultdict(float)
                    numeric_setpoint_keys = set()
                    for r in rows:
                        for k, v in r['setpoints_produced'].items():
                            # Average both percentage fields AND numeric fields like Order Scale Flowrate (t/h)
                            if isinstance(v, (int, float)) and ("%" in k or "t/h" in k):
                                avg_setpoints_numeric[k] += v
                                numeric_setpoint_keys.add(k)
                    for k in numeric_setpoint_keys:
                        avg_setpoints_numeric[k] = round(avg_setpoints_numeric[k] / count, 3)

                    # 6. Final setpoints: last row values + averaged numeric fields
                    # ✅ Include ALL fields from last row (including new Bool fields)
                    last_row = rows[-1]
                    final_setpoints = {}
                    for k, v in last_row['setpoints_produced'].items():
                        if k in avg_setpoints_numeric:
                            # Use averaged value for numeric fields (%, t/h)
                            final_setpoints[k] = avg_setpoints_numeric[k]
                        else:
                            # Use last value for boolean and other fields
                            final_setpoints[k] = v

                    # 7. ✅ Bran Receiver: Cumulative counters (NOT flow rates!)
                    # These values are ALREADY in kg and are cumulative totals from PLC
                    # We do NOT sum them or convert them - just store the LAST value!
                    last_row = rows[-1]
                    
                    # Store the LAST cumulative value for bran_receiver (not summed over the period!)
                    final_bran_receiver = {}
                    for k, v in last_row['bran_receiver'].items():
                        if isinstance(v, (int, float)):
                            final_bran_receiver[k] = round(float(v), 3)  # Just last value, already in kg

                    # 8. ✅ Receiver: FLOW RATE in kg/s - convert to total kg for the 30-minute period!
                    # Calculate time span
                    first_time = min(r.get('created_at') for r in rows)
                    last_time = max(r.get('created_at') for r in rows)
                    time_span_seconds = (last_time - first_time).total_seconds() if last_time and first_time else 1800
                    
                    if time_span_seconds < 60:
                        time_span_seconds = 1800  # Fallback to 30 minutes
                    
                    logger.info(f"📊 [MILA Archive] Records: {len(rows)} over {time_span_seconds:.0f}s")
                    
                    # SUM receiver flow rates (stored in kg/s, convert to total kg)
                    receiver_totals = defaultdict(lambda: {"bin_id": None, "material_code": None, "material_name": None, "sum_kg_s": 0.0})
                    
                    for row in rows:
                        receivers = row.get("receiver", [])
                        if isinstance(receivers, str):
                            receivers = json.loads(receivers or "[]")
                        
                        for rec in receivers:
                            bin_id = rec.get("bin_id")
                            code = rec.get("material_code")
                            name = rec.get("material_name")
                            kg_per_s = float(rec.get("weight_kg", 0))  # Already in kg/s from live monitor
                        
                            key = f"{bin_id}-{code}-{name}"
                            receiver_totals[key]["bin_id"] = bin_id
                            receiver_totals[key]["material_code"] = code
                            receiver_totals[key]["material_name"] = name
                            receiver_totals[key]["sum_kg_s"] += kg_per_s  # SUM all kg/s values
                    
                    # Convert summed kg/s to total kg for the 30-minute period
                    final_receiver = []
                    for val in receiver_totals.values():
                        avg_kg_s = val["sum_kg_s"] / len(rows)  # Average flow rate
                        total_kg = avg_kg_s * time_span_seconds  # Total kg over the time span
                        
                        final_receiver.append({
                            "bin_id": val["bin_id"],
                            "material_code": val["material_code"],
                            "material_name": val["material_name"],
                            "weight_kg": round(total_kg, 3)
                        })

                    # 9. ✅ Produced weight: Cumulative counter (NOT a flow rate!)
                    last_produced = float(last_row.get("produced_weight", 0))
                    total_produced_weight = round(last_produced, 3)  # Last value only, already in kg

                    # 10. Final yield log
                    final_yield_log = {
                        "Yield Max Flow (kg/s)": round(max_flow, 3),
                        "Yield Min Flow (kg/s)": round(min_flow, 3),
                        **avg_yield_pct
                    }

                    # ✅ Add MILA_Flour1 (%) if it was tracked separately
                    if mila_flour1_sum > 0 and count > 0:
                        final_yield_log["MILA_Flour1 (%)"] = round(mila_flour1_sum / count, 3)

                    # 11. ✅ STEP 2: INSERT aggregated data into archive table (mila_monitor_logs_archive)
                    # This is the MAIN table for reports
                    cur.execute("""
                        INSERT INTO mila_monitor_logs_archive (
                            order_name, status, receiver,
                            bran_receiver, yield_log, setpoints_produced,
                            produced_weight, created_at
                        )
                        VALUES (%s, %s, %s::jsonb, %s::jsonb, %s::jsonb,
                                %s::jsonb, %s, %s)
                    """, (
                        last_row["order_name"],
                        last_row["status"],
                        json.dumps(final_receiver),         # ✅ SUMMED from flow rates
                        json.dumps(final_bran_receiver),    # Last value, already kg
                        json.dumps(final_yield_log),
                        json.dumps(final_setpoints),
                        total_produced_weight,              # Last value, already kg
                        archive_cutoff  # ✅ End of archived period (Dubai), not run time
                    ))

                    # 12. ✅ STEP 3: DELETE the archived data from live table (mila_monitor_logs)
                    # CRITICAL: Delete ONLY the data we just archived to prevent double counting
                    # Use the SAME cutoff timestamp to ensure we delete exactly what we archived
                    cur.execute("""
                        DELETE FROM mila_monitor_logs
                        WHERE created_at < %s
                    """, (archive_cutoff,))
                    deleted_count = cur.rowcount
                    
                    # Commit both INSERT and DELETE in the same transaction
                    conn.commit()
                    
                    logger.info(f"✅ MILA Archive Complete:")
                    logger.info(f"   📥 Moved {len(rows)} rows from mila_monitor_logs (live) → mila_monitor_logs_archive (archive)")
                    logger.info(f"   🗑️  Deleted {deleted_count} rows from mila_monitor_logs (live table)")
                    logger.info(f"   📊 Order: {last_row['order_name']} | Produced Weight: {total_produced_weight} kg | Archive Time: {archive_time}")
                    
                    # ✅ Verify deletion was successful
                    if deleted_count != len(rows):
                        logger.warning(f"⚠️ [MILA Archive] WARNING: Archived {len(rows)} rows but deleted {deleted_count} rows!")
                        logger.warning(f"⚠️ This mismatch may cause double counting in next archive cycle!")

        except Exception as e:
            logger.error(f"❌ MILA archive error: {e}", exc_info=True)

        # ✅ Wait until the next 30-minute boundary (not just 1800 seconds)
        now = datetime.datetime.now()
        if now.minute < 30:
            next_boundary = now.replace(minute=30, second=0, microsecond=0)
        else:
            next_boundary = (now + datetime.timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
        wait_seconds = (next_boundary - now).total_seconds()
        logger.info(f"⏰ [MILA Archive] Next archive at {next_boundary.strftime('%H:%M:%S')} (sleeping {wait_seconds:.0f} seconds)")
        gevent.sleep(wait_seconds)

# ✅ OPTIMIZATION: Persistent PLC Connection Manager
class PersistentPLCConnection:
    """Manages persistent PLC connection with automatic reconnection"""
    
    def __init__(self, ip='192.168.23.11', rack=0, slot=3, name="PLC"):
        self.ip = ip
        self.rack = rack
        self.slot = slot
        self.name = name
        self.client = None
        self.connected = False
        self.last_error = None
        self.reconnect_attempts = 0
        
    def connect(self):
        """Establish PLC connection"""
        try:
            if self.client:
                try:
                    self.client.disconnect()
                    self.client.destroy()
                except:
                    pass
            
            self.client = snap7.client.Client()
            self.client.connect(self.ip, self.rack, self.slot)
            self.connected = True
            self.reconnect_attempts = 0
            logger.info(f"✅ [{self.name}] PLC connected: {self.ip}")
            return True
        except Exception as e:
            self.connected = False
            self.last_error = str(e)
            logger.error(f"❌ [{self.name}] PLC connection failed: {e}")
            return False
    
    def is_connected(self):
        """Check if connection is alive"""
        if not self.client or not self.connected:
            return False
        
        try:
            # Try a quick operation to verify connection
            self.client.get_cpu_state()
            return True
        except:
            self.connected = False
            return False
    
    def reconnect_if_needed(self):
        """Reconnect if connection is lost"""
        if not self.is_connected():
            logger.warning(f"⚠️ [{self.name}] Connection lost, reconnecting...")
            return self.connect()
        return True
    
    def read_db(self, db_number, start, size):
        """Read data from PLC DB with automatic reconnection"""
        max_retries = 3
        
        for attempt in range(max_retries):
            if not self.reconnect_if_needed():
                if attempt < max_retries - 1:
                    gevent.sleep(0.5)  # Wait before retry
                    continue
                else:
                    raise Exception(f"Failed to reconnect to PLC after {max_retries} attempts")
            
            try:
                data = self.client.db_read(db_number, start, size)
                return data
            except Exception as e:
                logger.warning(f"⚠️ [{self.name}] Read failed (attempt {attempt + 1}/{max_retries}): {e}")
                self.connected = False
                if attempt < max_retries - 1:
                    gevent.sleep(0.5)
                else:
                    raise
    
    def disconnect(self):
        """Disconnect from PLC"""
        try:
            if self.client:
                self.client.disconnect()
                self.client.destroy()
                self.connected = False
                logger.info(f"🔌 [{self.name}] PLC disconnected")
        except Exception as e:
            logger.warning(f"⚠️ [{self.name}] Error during disconnect: {e}")

# Create persistent PLC connections (will be initialized when monitors start)
fcl_plc = None
scl_plc = None
mila_plc = None

def get_next_order_number(prefix, live_table, archive_table):
    """
    Determines the next order number by checking both live and archive tables
    for the highest existing number associated with the given prefix.
    """
    max_num = 0
    
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Check live table
                cursor.execute(f"SELECT order_name FROM {live_table} WHERE order_name LIKE %s", (f'{prefix}%',))
                live_rows = cursor.fetchall()
                
                # Check archive table
                cursor.execute(f"SELECT order_name FROM {archive_table} WHERE order_name LIKE %s", (f'{prefix}%',))
                archive_rows = cursor.fetchall()
                
                all_rows = live_rows + archive_rows
                
                for row in all_rows:
                    name = row['order_name']
                    # Extract number part using regex
                    match = re.search(rf"^{prefix}(\d+)$", name)
                    if match:
                        num = int(match.group(1))
                        if num > max_num:
                            max_num = num
                            
    except Exception as e:
        logger.error(f"Error calculating next order number for {prefix}: {e}")
        
    return max_num + 1

mila_order_counter = 1
mila_current_order_name = None
mila_session_started = None

def mila_realtime_monitor():
    import datetime
    import json

    global mila_order_counter, mila_current_order_name, mila_session_started

    # Initialize counter from DB
    mila_order_counter = get_next_order_number("MILA", "mila_monitor_logs", "mila_monitor_logs_archive")
    logger.info(f"✅ MILA monitor started. Next Order ID: {mila_order_counter}")

    # Material keyword → DB2099 key mapping
    material_flow_mapping = {
        "semolina": "mila_semolina",
        "flour": "mila_flour_1",
        "baking": "mila_flour_1",
        "bran fine": "bran_fine",
        "bran coarse": "bran_coarse"
    }

    while True:
        loop_start_time = time.time()  # ✅ Record loop start time
        try:
            res = http.request("GET", "http://localhost:5000/orders/plc/db499-db2099-monitor")
            if res.status != 200:
                logger.warning("⚠️ Failed to fetch MILA monitor")
                gevent.sleep(1)
                continue

            data = json.loads(res.data.decode("utf-8"))
            if data.get("status") != "success":
                logger.warning("❌ Invalid response from MILA monitor")
                gevent.sleep(1)
                continue

            DB499 = data.get("DB499", {})
            DB2099 = data.get("DB2099", {})

            # WebSocket data
            mila_websocket_data = {
                "DB499": DB499,
                "DB2099": DB2099,
                "bran_receiver": data.get("bran_receiver", {}),  # ✅ Include bran_receiver for live monitor
                "f2_scale": data.get("f2_scale", {}),  # F2 Scale (Mill A Flour 2) from DB2099
                "receiver_bins": data.get("receiver_bins", []),
                "timestamp": datetime.datetime.now().isoformat()
            }
            socketio.emit("mila_data", mila_websocket_data)

            # Enrich receiver bin weights - Use same logic as frontend
            # ✅ Only process first 2 receiver bins (exclude Semolina)
            receiver_bins = []
            receiver_bin_list = data.get("receiver_bins", [])
            
            for idx, bin_data in enumerate(receiver_bin_list):
                # Skip Semolina entries (material_code 9103 or idx > 1)
                material = bin_data.get("material")
                if material and material.get("material_code") == "9103":
                    logger.debug(f"[MILA] Skipping Semolina receiver (bin_id={bin_data.get('bin_id')})")
                    continue
                
                # Only process first 2 receiver bins
                if idx > 1:
                    logger.debug(f"[MILA] Skipping receiver bin {idx} (only first 2 bins stored)")
                    continue
                
                entry = {
                    "material_name": None,
                    "material_code": None,
                    "weight_kg": 0
                }
                
                bin_id = bin_data.get("bin_id")
                
                # Use database material if available, otherwise use default names
                if material:
                    entry["material_name"] = material.get("material_name")
                    entry["material_code"] = material.get("material_code")
                
                # Match receiver bin position to DB2099 flow field (same as frontend logic)
                if idx == 0 and DB499.get("receiver_bin_id_1", 0) != 0:
                    # First receiver bin uses yield_max_flow (PLC sends in t/h)
                    flow_rate_tph = DB2099.get("yield_max_flow", 0)
                    # ✅ Convert t/h to kg/s for consistent storage
                    entry["weight_kg"] = flow_rate_tph * 1000 / 3600  # t/h → kg/s
                    # Provide default name if not in database
                    if not entry["material_name"]:
                        entry["material_name"] = "Flour Silo"
                        entry["material_code"] = "0051"
                    
                    # ✅ Store bin ID directly in the entry for report display
                    entry["bin_id"] = str(bin_id) if bin_id else "Unknown"
                    
                    logger.debug(f"[MILA] Receiver bin 1 (bin_id={bin_id}) → {flow_rate_tph} t/h = {entry['weight_kg']:.3f} kg/s")
                    receiver_bins.append(entry)
                elif idx == 1 and DB499.get("receiver_bin_id_2", 0) != 0:
                    # Second receiver bin uses yield_min_flow (PLC sends in t/h)
                    flow_rate_tph = DB2099.get("yield_min_flow", 0)
                    # ✅ Convert t/h to kg/s for consistent storage
                    entry["weight_kg"] = flow_rate_tph * 1000 / 3600  # t/h → kg/s
                    # Provide default name if not in database
                    if not entry["material_name"]:
                        entry["material_name"] = "Flour Silo"
                        entry["material_code"] = "0055"
                        
                    # ✅ Store bin ID directly in the entry for report display
                    entry["bin_id"] = str(bin_id) if bin_id else "Unknown"
                    
                    logger.debug(f"[MILA] Receiver bin 2 (bin_id={bin_id}) → {flow_rate_tph} t/h = {entry['weight_kg']:.3f} kg/s")
                    receiver_bins.append(entry)
                else:
                    logger.debug(f"[MILA] Receiver bin {idx} (bin_id={bin_id}) inactive or not configured")
            
            # ✅ Flour 2 Receiver 1 (offset 176): store F2 flow rate t/h same as receiver bin flow (t/h → kg/s)
            flour2_bin_id = DB499.get("flour2_receiver_bin_id_1", 0)
            if flour2_bin_id and flour2_bin_id != 0:
                f2_flow_tph = data.get("f2_scale", {}).get("flow_rate_tph", 0) or 0
                weight_kg_s = f2_flow_tph * 1000 / 3600  # t/h → kg/s
                # Find Flour 2 Receiver 1 in receiver_bin_list (typically index 2)
                flour2_bin_data = next((b for b in receiver_bin_list if str(b.get("bin_id")) == str(flour2_bin_id)), None)
                material = flour2_bin_data.get("material") if flour2_bin_data else None
                receiver_bins.append({
                    "bin_id": str(flour2_bin_id),
                    "material_name": material.get("material_name") if material else "Flour 2 Receiver 1",
                    "material_code": material.get("material_code") if material else "—",
                    "weight_kg": round(weight_kg_s, 6),
                })
                logger.debug(f"[MILA] Flour 2 Receiver 1 (bin_id={flour2_bin_id}) → {f2_flow_tph} t/h = {weight_kg_s:.3f} kg/s")
            
            # Semolina is tracked in bran_receiver, not in receiver

            # ✅ Use Asia/Dubai timezone (UTC+4) for correct local timestamps
            import pytz
            from datetime import datetime as dt
            dubai_tz = pytz.timezone('Asia/Dubai')
            # Get current UTC time and convert to Dubai timezone (naive datetime for TIMESTAMP column)
            now = dt.now(pytz.utc).astimezone(dubai_tz).replace(tzinfo=None)
            
            # ✅ Get job_status from DB2099 (Bool converted to Int: 1=active, 0=done)
            job_status = DB2099.get("job_status", 0)
            linning_running = DB499.get('linning_running', False)
            logger.info(f"[MILA] Loop Time: {now} | Job Status: {job_status} | Line Running: {linning_running}")

            # ✅ Use job_status for order management (like FCL/SCL)
            # 🟢 Start/Create order when job_status == 1 (order_active)
            if job_status == 1:
                if not mila_current_order_name or not mila_session_started:
                    mila_current_order_name = f"MILA{mila_order_counter}"
                    mila_order_counter += 1
                    mila_session_started = now
                    logger.info(f"🆕 New MILA Order Started: {mila_current_order_name} (job_status=1)")

            # 🔴 End current order when job_status == 0 (order_done)
            elif job_status == 0:
                if mila_current_order_name:
                    logger.info(f"✅ MILA order done: {mila_current_order_name} (job_status=0) - waiting for next order")
                    mila_current_order_name = None
                    mila_session_started = None

            # ✅ ALWAYS store data (regardless of line_running or job_status)
            # Data must be stored every second to track all values continuously

            # Structured yield log
            # ✅ Convert flow rates from t/h to kg/s for consistent storage
            yield_max_tph = DB2099.get("yield_max_flow", 0)
            yield_min_tph = DB2099.get("yield_min_flow", 0)
            
            yield_log = {
                "Yield Max Flow (kg/s)": round(yield_max_tph * 1000 / 3600, 3) if yield_max_tph else 0,  # t/h → kg/s
                "Yield Min Flow (kg/s)": round(yield_min_tph * 1000 / 3600, 3) if yield_min_tph else 0,  # t/h → kg/s
                "MILA_B1 (%)": DB2099.get("mila_b1", 0),
                "MILA_Flour1 (%)": DB2099.get("mila_flour_1", 0),
                "MILA_BranCoarse (%)": DB2099.get("mila_bran_coarse", 0),
                "MILA_Semolina (%)": DB2099.get("mila_semolina", 0),
                "MILA_BranFine (%)": DB2099.get("mila_bran_fine", 0),
                "flow_percentage (%)": data.get("f2_scale", {}).get("flow_percentage", 0) or 0,  # F2 scale offset 180
            }

            # ✅ Use bran_receiver Non-Erasable Weights from API (DInt values in kg from DB2099)
            bran_receiver = data.get("bran_receiver", {})
            # Format with proper labels for database storage
            bran_receiver_formatted = {
                "9106 Bran coarse (kg)": bran_receiver.get("bran_coarse", 0),
                "9105 Bran fine (kg)": bran_receiver.get("bran_fine", 0),
                "MILA_Flour1 (kg)": bran_receiver.get("flour_1", 0),
                "B1Scale (kg)": bran_receiver.get("b1", 0),
                "Semolina (kg)": bran_receiver.get("semolina", 0),
                "F2 Scale (kg)": data.get("f2_scale", {}).get("totalizer_kg", 0) or 0,  # F2 scale offset 184
            }

            # Setpoint and status info (sorted by offset)
            setpoints_produced = {
                "Order Scale Flowrate (t/h)": DB499.get("order_scale_flowrate", 0),
                "Feeder 1 Target (%)": DB499.get("feeder_1_target", 0),
                "Feeder 1 Enabled (Bool)": DB499.get("feeder_1_selected", False),
                "Feeder 2 Target (%)": DB499.get("feeder_2_target", 0),
                "Feeder 2 Enabled (Bool)": DB499.get("feeder_2_selected", False),
                "B1 Scale1 (Bool)": DB499.get("b1_scale1", False),
                "B3 Chocke Feeder (Bool)": DB499.get("b3_chocke_feeder", False),
                "Filter Flour Feeder (Bool)": DB499.get("filter_flour_feeder", False),
                "E11 (Bool)": DB499.get("e11_selected", False),
                "E10 (Bool)": DB499.get("e10_selected", False),
                "B1 Deopt Emptying (Bool)": DB499.get("b1_deopt_emptying", False),
                "Mill Emptying (Bool)": DB499.get("mill_emptying", False),
                "Flap 1 Selected (Bool)": DB499.get("flap_1_selected", False),
                "Flap 2 Selected (Bool)": DB499.get("flap_2_selected", False),
                "Depot Selected (Bool)": DB499.get("depot_selected", False),
                "Semolina Selected (Bool)": DB499.get("semolina_selected", False),
                "MILA_2_B789WE Selected (Bool)": DB499.get("mila_2_b789we_selected", False)
            }

            # Final produced weight (sum of known flows)
            produced_weight = round(
                DB2099.get("bran_coarse", 0) +
                DB2099.get("bran_fine", 0) +
                DB2099.get("mila_flour_1", 0) +
                DB2099.get("mila_semolina", 0) +
                DB2099.get("mila_B1_scale", 0),
                6
            )

            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO mila_monitor_logs (
                        order_name, status, receiver,
                        bran_receiver, yield_log,
                        setpoints_produced, produced_weight, created_at
                    ) VALUES (%s, %s, %s::jsonb, %s::jsonb, %s::jsonb,
                              %s::jsonb, %s, %s)
                """, (
                    mila_current_order_name,
                    "running",
                    json.dumps(receiver_bins),
                    json.dumps(bran_receiver_formatted),  # ✅ Use formatted bran receiver with DInt values
                    json.dumps(yield_log),
                    json.dumps(setpoints_produced),
                    produced_weight,
                    now  # ✅ Now uses Asia/Dubai timezone
                ))
                conn.commit()
                logger.info(f"✅ MILA log saved: {mila_current_order_name} | Produced: {produced_weight} kg | Time: {now}")

        except Exception as e:
            logger.error(f"❌ MILA monitor error: {e}", exc_info=True)

        # ✅ Dynamic sleep to ensure EXACTLY 1 second per loop
        elapsed = time.time() - loop_start_time
        sleep_time = max(0, 1.0 - elapsed)
        if sleep_time < 0.5:
            logger.warning(f"[MILA] Loop took {elapsed:.3f}s, only sleeping {sleep_time:.3f}s")
        gevent.sleep(sleep_time)

import datetime
import json

monitor_running = False
fcl_order_counter = 1
fcl_current_order_name = None
fcl_session_started = None
fcl_last_job_status = None

def fcl_realtime_monitor():
    global monitor_running, fcl_order_counter
    global fcl_current_order_name, fcl_session_started, fcl_last_job_status

    monitor_running = True
    
    # Initialize counter from DB
    fcl_order_counter = get_next_order_number("FCL", "fcl_monitor_logs", "fcl_monitor_logs_archive")
    logger.info(f"✅ FCL monitor started. Next Order ID: {fcl_order_counter}")

    while True:
        loop_start_time = time.time()  # ✅ Record loop start time
        try:
            res = http.request("GET", "http://localhost:5000/orders/plc/db199-monitor")
            if res.status != 200:
                logger.warning("⚠️ Failed to fetch /db199-monitor")
                gevent.sleep(1)
                continue

            response_json = json.loads(res.data.decode("utf-8"))
            data = response_json.get("data", {})
            fcl_receivers = response_json.get("fcl_receivers", [])  # ✅ Extract fcl_receivers from response
            
            # ✅ Include fcl_receivers in the data being emitted
            data['fcl_receivers'] = fcl_receivers
            
            logger.info(f"[FCL] Loop Time: {datetime.datetime.now()} | Job Status: {data.get('job_status')} | Order: {fcl_current_order_name} | Receivers: {[r.get('id') for r in fcl_receivers]}")

            socketio.emit("fcl_data", data)

            job_status = data.get("job_status")
            line_running = data.get("line_running", False)
            now = datetime.datetime.now()

            logger.debug(f"FCL Monitor Loop: job_status={job_status}, line_running={line_running}, current_order={fcl_current_order_name}")

            # 🟢 Start/Create order when job_status == 1 (order_active)
            if job_status == 1:
                if not fcl_current_order_name or not fcl_session_started:
                    # Create new order
                    fcl_session_started = now
                    fcl_current_order_name = f"FCL{fcl_order_counter}"
                    fcl_order_counter += 1
                    logger.info(f"🆕 FCL order started: {fcl_current_order_name} (job_status=1)")
                fcl_last_job_status = 1

            # 🔴 End current order when job_status == 0 (order_done) - clear name *after* insert so this row keeps order_name
            elif job_status == 0:
                if fcl_current_order_name:
                    logger.info(f"✅ FCL order done: {fcl_current_order_name} (job_status=0) - will clear after insert")
                fcl_last_job_status = 0

            # ✅ Order name creation (only when line is running)
            if line_running:
                # Ensure we have an order name
                if not fcl_current_order_name or not fcl_session_started:
                    fcl_current_order_name = f"FCL{fcl_order_counter}"
                    fcl_order_counter += 1
                    fcl_session_started = now
                    logger.warning(f"⚠️ FCL line_running=true but no order. Creating: {fcl_current_order_name}")

            # ✅ ALWAYS store data (regardless of line_running) to track FCL_2_520WE continuously
            # Use the enriched sources data (already includes weight and material info)
            enriched_sources = data.get("active_sources", [])
            total_sender_weight = 0.0

            for src in enriched_sources:
                weight = float(src.get("weight", 0.0))  # t/h
                total_sender_weight += weight

            # ✅ Get all receivers (array of objects)
            fcl_receivers = data.get("fcl_receivers", [])
            
            # ✅ FIX: Only sum flow rates (t/h), exclude cumulative counters (kg)
            # Receiver 1: bin 29 with flow rate ~23.9 t/h
            # Receiver 2: FCL_2_520WE with cumulative kg counter (don't add to produced_weight!)
            total_receiver_weight = 0.0
            for r in fcl_receivers:
                receiver_id = r.get("id", "")
                weight = float(r.get("weight", 0))
                
                # Only include flow rates (not cumulative counters like FCL_2_520WE)
                if receiver_id != "FCL_2_520WE" and "520WE" not in str(receiver_id):
                    total_receiver_weight += weight
                    logger.debug(f"[FCL] Adding receiver {receiver_id}: {weight} t/h to total")
                else:
                    logger.debug(f"[FCL] Skipping cumulative counter {receiver_id}: {weight} kg (not added to produced_weight)")
            
            # For backwards compatibility, store the first receiver's weight (bin 29 flow rate)
            receiver_weight = total_receiver_weight
            
            # ✅ Produced weight = sender flow rates + receiver flow rates (all in t/h)
            produced_weight = round(total_sender_weight + total_receiver_weight, 6)
            
            logger.info(f"[FCL] Senders: {total_sender_weight:.3f} t/h | Receiver flow: {total_receiver_weight:.3f} t/h | Produced: {produced_weight:.3f} t/h | Line Running: {line_running}")

            # Insert log - ALWAYS store data regardless of line_running status
            try:
                # ✅ Use Asia/Dubai timezone (UTC+4) for correct local timestamps
                import pytz
                from datetime import datetime as dt
                dubai_tz = pytz.timezone('Asia/Dubai')
                # Get current UTC time and convert to Dubai timezone (naive datetime for TIMESTAMP column)
                now = dt.now(pytz.utc).astimezone(dubai_tz).replace(tzinfo=None)
                
                with get_db_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute("""
                        CREATE TABLE IF NOT EXISTS fcl_monitor_logs (
                            id SERIAL PRIMARY KEY,
                            job_status INT,
                            line_running BOOLEAN,
                            receiver NUMERIC,
                            fcl_receivers JSONB,
                            flow_rate NUMERIC,
                            produced_weight NUMERIC,
                            water_consumed NUMERIC,
                            moisture_offset NUMERIC,
                            moisture_setpoint NUMERIC,
                            cleaning_scale_bypass BOOLEAN,
                            active_sources JSONB,
                            active_destination JSONB,
                            order_name TEXT,
                            created_at TIMESTAMP DEFAULT NOW()
                        );
                    """)

                    cursor.execute("""
                        INSERT INTO fcl_monitor_logs (
                            job_status, line_running, receiver, fcl_receivers, flow_rate, produced_weight,
                            water_consumed, moisture_offset, moisture_setpoint, cleaning_scale_bypass,
                            active_sources, active_destination, order_name, created_at
                        ) VALUES (%s, %s, %s, %s::jsonb, %s, %s, %s, %s, %s, %s,
                                  %s::jsonb, %s::jsonb, %s, %s)
                    """, (
                        job_status,
                        data.get("line_running"),  # Store actual line_running value (true/false)
                        receiver_weight,  # ✅ Only flow rate (t/h), not cumulative
                        json.dumps(fcl_receivers),
                        data.get("flow_rate"),
                        produced_weight,  # ✅ Sum of all flow rates (t/h)
                        (data.get("water_flow_lh") or data.get("water_consumed")) or 0,  # ✅ Rate l/h (same as receiver; archive sums over hour)
                        data.get("moisture_offset"),
                        data.get("moisture_setpoint"),
                        data.get("cleaning_scale_bypass"), # ✅ New field
                        json.dumps(enriched_sources),
                        json.dumps(data.get("active_destination")),
                        fcl_current_order_name,  # May be None if line not running
                        now  # ✅ Explicit Asia/Dubai timestamp
                    ))
                    conn.commit()
                    logger.info(f"✅ FCL log saved: {fcl_current_order_name or 'NO_ORDER'} | Job Status: {job_status} | Line Running: {line_running} | Sender: {total_sender_weight:.3f} t/h | Receiver: {receiver_weight:.3f} t/h | Produced: {produced_weight:.3f} t/h | Time: {now}")
            except Exception as db_err:
                logger.error(f"❌ DB insert failed: {db_err}", exc_info=True)

            fcl_last_job_status = job_status
            # ✅ Clear order name only after insert so the "order just ended" row still has order_name (live + archive)
            if job_status == 0 and fcl_current_order_name:
                fcl_current_order_name = None
                fcl_session_started = None

        except Exception as e:
            logger.error(f"❌ FCL monitor error: {e}", exc_info=True)

        # ✅ Dynamic sleep to ensure EXACTLY 1 second per loop
        elapsed = time.time() - loop_start_time
        sleep_time = max(0, 1.0 - elapsed)
        if sleep_time < 0.5:
            logger.warning(f"[FCL] Loop took {elapsed:.3f}s, only sleeping {sleep_time:.3f}s")
        gevent.sleep(sleep_time)

scl_monitor_running = False
scl_current_order_name = None
scl_session_started = None
scl_order_counter = 1
scl_last_job_status = None
scl_data_stored = False

def scl_realtime_monitor():
    global scl_monitor_running, scl_current_order_name, scl_session_started, scl_order_counter, scl_last_job_status
    global scl_data_stored

    scl_monitor_running = True
    
    # Initialize counter from DB
    scl_order_counter = get_next_order_number("SCL", "scl_monitor_logs", "scl_monitor_logs_archive")
    logger.info(f"✅ SCL monitor started. Next Order ID: {scl_order_counter}")

    while True:
        loop_start_time = time.time()  # ✅ Record loop start time
        try:
            res = http.request("GET", "http://localhost:5000/orders/plc/db299-monitor")
            if res.status != 200:
                logger.warning("⚠️ Failed to fetch /db299-monitor")
                gevent.sleep(1)
                continue

            data = json.loads(res.data.decode("utf-8")).get("data", {})
            logger.info(f"[SCL] Loop Time: {datetime.datetime.now()} | Job Status: {data.get('JobStatusCode')} | Order: {scl_current_order_name}")

            socketio.emit("scl_data", data)

            job_status = data.get("JobStatusCode")
            line_running = data.get("line_running", False)
            now = datetime.datetime.now()

            # 🟢 Start/Create order when job_status == 1 (order_active)
            if job_status == 1:
                if not scl_current_order_name or not scl_session_started:
                    # Create new order
                    scl_session_started = now
                    scl_current_order_name = f"SCL{scl_order_counter}"
                    scl_order_counter += 1
                    scl_last_job_status = 1
                    scl_data_stored = False
                    logger.info(f"🆕 SCL order started: {scl_current_order_name} (job_status=1)")

            # 🔴 End current order when job_status == 0 (order_done) - DO NOT create new order yet
            elif job_status == 0:
                if scl_current_order_name:
                    logger.info(f"✅ SCL order done: {scl_current_order_name} (job_status=0) - waiting for next order")
                    scl_current_order_name = None  # Clear order name, wait for next job_status=1
                    scl_session_started = None
                    scl_last_job_status = 0
                    scl_data_stored = False

            # ✅ Only store data when line_running == true (regardless of job_status)
            if line_running:
                # Ensure we have an order name
                if not scl_current_order_name or not scl_session_started:
                    scl_current_order_name = f"SCL{scl_order_counter}"
                    scl_order_counter += 1
                    scl_session_started = now
                    logger.warning(f"⚠️ SCL line_running=true but no order. Creating: {scl_current_order_name}")

                # ✅ Compute sender weight (sum of all active sources)
                total_sender_weight = 0.0
                active_sender_bins = []
                for src in data.get("ActiveSources", []):
                    sender_weight = float(src.get("flowrate_tph", 0.0))
                    total_sender_weight += sender_weight
                    active_sender_bins.append(src.get("bin_id"))

                # ✅ Force receiver weight to match sender weight (Input = Output)
                receiver_weight = total_sender_weight
                logger.info(f"[SCL] ✅ Receiver weight synced to sender: {receiver_weight} t/h")
                
                # ✅ Produced weight is just the output (receiver), not sum of both
                produced_weight = round(receiver_weight, 6)
                logger.info(f"[SCL] 📊 Final → Sender: {total_sender_weight:.3f} t/h | Receiver: {receiver_weight:.3f} t/h | Produced: {produced_weight:.3f} t/h")

                # ✅ Construct active_destination object from DestBinId and DestMaterial
                active_destination = {}
                dest_bin_id = data.get("DestBinId", 0)
                dest_material = data.get("DestMaterial", {})
                
                if dest_bin_id and dest_bin_id > 0:
                    active_destination = {
                        "bin_id": dest_bin_id,
                        "dest_no": 1,  # Default destination number
                        "material": dest_material,
                        "prd_code": dest_material.get("id", 0) if dest_material else 0
                    }
                    logger.info(f"[SCL] 📦 Active Destination: bin {dest_bin_id}, material: {dest_material.get('material_name', 'N/A')}")
                
                try:
                    # ✅ Use Asia/Dubai timezone (UTC+4) for correct local timestamps
                    import pytz
                    from datetime import datetime as dt
                    dubai_tz = pytz.timezone('Asia/Dubai')
                    # Get current UTC time and convert to Dubai timezone (naive datetime for TIMESTAMP column)
                    now = dt.now(pytz.utc).astimezone(dubai_tz).replace(tzinfo=None)
                    
                    with get_db_connection() as conn:
                        cursor = conn.cursor()
                        # Ensure table with created_at
                        cursor.execute("""
                            CREATE TABLE IF NOT EXISTS scl_monitor_logs (
                                id SERIAL PRIMARY KEY,
                                job_status INT,
                                line_running BOOLEAN,
                                receiver NUMERIC,
                                flow_rate NUMERIC,
                                produced_weight NUMERIC,
                                water_consumed NUMERIC,
                                moisture_offset NUMERIC,
                                moisture_setpoint NUMERIC,
                                active_sources JSONB,
                                active_destination JSONB,
                                order_name TEXT,
                                created_at TIMESTAMP DEFAULT NOW()
                            );
                        """)

                        # Insert log
                        cursor.execute("""
                            INSERT INTO scl_monitor_logs (
                                job_status, line_running, receiver, flow_rate, produced_weight,
                                water_consumed, moisture_offset, moisture_setpoint,
                                active_sources, active_destination, order_name, created_at
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s,
                                      %s::jsonb, %s::jsonb, %s, %s)
                        """, (
                            job_status,
                            data.get("line_running"),
                            receiver_weight,  # ✅ Use calculated receiver weight (t/h)
                            data.get("Flowrate"),
                            produced_weight,
                            0,
                            data.get("MoistureOffset"),
                            data.get("MoistureSetpoint"),
                            json.dumps(data.get("ActiveSources")),
                            json.dumps(active_destination),  # ✅ Use constructed active_destination
                            scl_current_order_name,
                            now  # ✅ Explicit Asia/Dubai timestamp
                        ))

                        conn.commit()
                        logger.info(f"✅ SCL log saved: {scl_current_order_name} | Job Status: {job_status} | Line Running: {line_running} | Sender: {total_sender_weight:.3f} t/h | Receiver: {receiver_weight:.3f} t/h | Produced: {produced_weight:.3f} t/h | Time: {now}")
                        scl_data_stored = True

                except Exception as db_err:
                    logger.error(f"❌ SCL DB insert failed: {db_err}", exc_info=True)

                scl_last_job_status = job_status
            else:
                # Line not running - don't store data
                logger.debug(f"[SCL] Line not running (line_running={line_running}), skipping data storage")

        except Exception as e:
            logger.error(f"❌ SCL monitor error: {e}", exc_info=True)

        # ✅ Dynamic sleep to ensure EXACTLY 1 second per loop
        elapsed = time.time() - loop_start_time
        sleep_time = max(0, 1.0 - elapsed)
        if sleep_time < 0.5:
            logger.warning(f"[SCL] Loop took {elapsed:.3f}s, only sleeping {sleep_time:.3f}s")
        gevent.sleep(sleep_time)


# FTRA Monitor
ftra_monitor_running = False
ftra_current_order_name = None
ftra_session_started = None
ftra_order_counter = 1
ftra_last_line_running = False
ftra_data_stored = False

def ftra_realtime_monitor():
    global ftra_monitor_running, ftra_current_order_name, ftra_session_started, ftra_order_counter
    global ftra_last_line_running, ftra_data_stored

    ftra_monitor_running = True
    
    # Initialize counter from DB
    ftra_order_counter = get_next_order_number("FTRA", "ftra_monitor_logs", "ftra_monitor_logs_archive")
    logger.info(f"✅ FTRA monitor started. Next Order ID: {ftra_order_counter}")

    while True:
        loop_start_time = time.time()
        try:
            res = http.request("GET", "http://localhost:5000/orders/plc/ftra-monitor")
            if res.status != 200:
                logger.warning("⚠️ Failed to fetch /ftra-monitor")
                gevent.sleep(1)
                continue

            data = json.loads(res.data.decode("utf-8")).get("data", {})
            logger.info(f"[FTRA] Loop Time: {datetime.datetime.now()} | Receiver: {data.get('ReceiverBinId')} | Senders: {[s.get('bin_id') for s in data.get('ActiveSources', [])]}")

            socketio.emit("ftra_data", data)

            # Check if line is running using PLC status bit at offset 106
            # 1 = order_active (order started), 0 = order_done (order finished)
            active_sources = data.get("ActiveSources", [])
            line_running = data.get("OrderActive", False)  # ✅ Use PLC bit at offset 106
            now = datetime.datetime.now()

            # 🟢 Start/Create order when line starts running
            if line_running:
                if not ftra_current_order_name or not ftra_session_started:
                    # Create new order
                    ftra_session_started = now
                    ftra_current_order_name = f"FTRA{ftra_order_counter}"
                    ftra_order_counter += 1
                    ftra_data_stored = False
                    logger.info(f"🆕 FTRA order started: {ftra_current_order_name}")

            # 🔴 End current order when line stops running
            elif not line_running:
                if ftra_current_order_name:
                    logger.info(f"✅ FTRA order done: {ftra_current_order_name} - waiting for next order")
                    ftra_current_order_name = None
                    ftra_session_started = None
                    ftra_data_stored = False

            # ✅ Only store data when line_running == true
            if line_running:
                # Ensure we have an order name
                if not ftra_current_order_name or not ftra_session_started:
                    ftra_current_order_name = f"FTRA{ftra_order_counter}"
                    ftra_order_counter += 1
                    ftra_session_started = now
                    logger.warning(f"⚠️ FTRA line_running=true but no order. Creating: {ftra_current_order_name}")

                # ✅ Compute sender weight (sum of all active sources)
                total_sender_weight = 0.0
                active_sender_bins = []
                for src in active_sources:
                    sender_weight = float(src.get("weight", 0.0))
                    total_sender_weight += sender_weight
                    active_sender_bins.append(src.get("bin_id"))

                # ✅ Receiver weight = sender weight (Input = Output)
                receiver_weight = total_sender_weight
                produced_weight = round(receiver_weight, 6)
                
                logger.info(f"[FTRA] 📊 Sender: {total_sender_weight:.3f} t/h | Receiver: {receiver_weight:.3f} t/h | Produced: {produced_weight:.3f} t/h")

                try:
                    # ✅ Use Asia/Dubai timezone (UTC+4) for correct local timestamps
                    import pytz
                    from datetime import datetime as dt
                    dubai_tz = pytz.timezone('Asia/Dubai')
                    now = dt.now(pytz.utc).astimezone(dubai_tz).replace(tzinfo=None)
                    
                    with get_db_connection() as conn:
                        cursor = conn.cursor()
                        # Ensure table exists
                        cursor.execute("""
                            CREATE TABLE IF NOT EXISTS ftra_monitor_logs (
                                id SERIAL PRIMARY KEY,
                                receiver_bin_id INT,
                                sender_1_bin_id INT,
                                sender_2_bin_id INT,
                                feeder_3_target NUMERIC,
                                feeder_3_selected BOOLEAN,
                                feeder_4_target NUMERIC,
                                feeder_4_selected BOOLEAN,
                                feeder_5_target NUMERIC,
                                feeder_5_selected BOOLEAN,
                                feeder_6_target NUMERIC,
                                feeder_6_selected BOOLEAN,
                                speed_discharge_50 NUMERIC,
                                speed_discharge_51_55 NUMERIC,
                                bag_collection BOOLEAN,
                                mixing_screw BOOLEAN,
                                line_running BOOLEAN,
                                receiver_weight NUMERIC,
                                produced_weight NUMERIC,
                                active_sources JSONB,
                                order_name TEXT,
                                created_at TIMESTAMP DEFAULT NOW()
                            );
                        """)

                        # Insert log
                        cursor.execute("""
                            INSERT INTO ftra_monitor_logs (
                                receiver_bin_id, sender_1_bin_id, sender_2_bin_id,
                                feeder_3_target, feeder_3_selected,
                                feeder_4_target, feeder_4_selected,
                                feeder_5_target, feeder_5_selected,
                                feeder_6_target, feeder_6_selected,
                                speed_discharge_50, speed_discharge_51_55,
                                bag_collection, mixing_screw,
                                line_running, receiver_weight, produced_weight,
                                active_sources, order_name, created_at
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s)
                        """, (
                            data.get("ReceiverBinId"),
                            data.get("Sender1BinId"),
                            data.get("Sender2BinId"),
                            data.get("Feeder3TargetPercent"),
                            data.get("Feeder3Selected"),
                            data.get("Feeder4TargetPercent"),
                            data.get("Feeder4Selected"),
                            data.get("Feeder5TargetPercent"),
                            data.get("Feeder5Selected"),
                            data.get("Feeder6TargetPercent"),
                            data.get("Feeder6Selected"),
                            data.get("SpeedDischarge50Percent"),
                            data.get("SpeedDischarge51_55Percent"),
                            data.get("BagCollection"),
                            data.get("MixingScrew"),
                            line_running,
                            receiver_weight,
                            produced_weight,
                            json.dumps(active_sources),
                            ftra_current_order_name,
                            now
                        ))

                        conn.commit()
                        logger.info(f"✅ FTRA log saved: {ftra_current_order_name} | Sender: {total_sender_weight:.3f} t/h | Receiver: {receiver_weight:.3f} t/h | Time: {now}")
                        ftra_data_stored = True

                except Exception as db_err:
                    logger.error(f"❌ FTRA DB insert failed: {db_err}", exc_info=True)

                ftra_last_line_running = line_running
            else:
                # Line not running - don't store data
                logger.debug(f"[FTRA] Line not running, skipping data storage")

        except Exception as e:
            logger.error(f"❌ FTRA monitor error: {e}", exc_info=True)

        # Sleep to maintain ~1 second loop
        elapsed = time.time() - loop_start_time
        sleep_time = max(0.1, 1.0 - elapsed)
        if elapsed > 1.0:
            logger.warning(f"[FTRA] Loop took {elapsed:.3f}s, only sleeping {sleep_time:.3f}s")
        gevent.sleep(sleep_time)


def emit_hourly_data():
    while True:
        try:
            with get_db_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                    # FCL hourly data (using created_at)
                    cursor.execute("""
                        SELECT DISTINCT ON (date_trunc('hour', created_at)) *
                        FROM fcl_monitor_logs_archive
                        ORDER BY date_trunc('hour', created_at) DESC, created_at DESC
                    """)
                    fcl_rows = cursor.fetchall()

                    # SCL hourly data (using created_at)
                    cursor.execute("""
                        SELECT DISTINCT ON (date_trunc('hour', created_at)) *
                        FROM scl_monitor_logs_archive
                        ORDER BY date_trunc('hour', created_at) DESC, created_at DESC
                    """)
                    scl_rows = cursor.fetchall()

                    # MILA hourly data (also using created_at)
                    cursor.execute("""
                        SELECT DISTINCT ON (date_trunc('hour', created_at)) *
                        FROM mila_monitor_logs_archive
                        ORDER BY date_trunc('hour', created_at) DESC, created_at DESC
                    """)
                    mila_rows = cursor.fetchall()

                    # Emit all 3
                    socketio.emit('hourly_archive_data', {
                        'fcl': fcl_rows,
                        'scl': scl_rows,
                        'mila': mila_rows
                    })

        except Exception as e:
            logger.error(f"❌ Error in hourly archive emit: {e}", exc_info=True)

        gevent.sleep(3600)  # or 60 for dev testing



# SocketIO event handlers
@socketio.on('connect')
def handle_connect():
    global monitor_running
    logger.info('Client connected to WebSocket')
    
    # Monitor is already spawned on module import — no need to spawn again
    logger.info('FCL monitor already running' if monitor_running else 'Waiting for monitor startup')

@socketio.on('disconnect')
def handle_disconnect():
    logger.info('Client disconnected from WebSocket')

@socketio.on('message')
def handle_message(message):
    logger.info(f'Received message: {message}')


if not monitor_running:
    logger.info("🟢 Spawning FCL, SCL, and MILA monitors on import")

    # FCL
    gevent.spawn(fcl_realtime_monitor)
    gevent.spawn(archive_old_logs)

    # SCL
    gevent.spawn(scl_realtime_monitor)
    gevent.spawn(archive_old_scl_logs)

    # ✅ MILA
    gevent.spawn(mila_realtime_monitor)
    gevent.spawn(archive_mila_logs)

    # ✅ FTRA
    gevent.spawn(ftra_realtime_monitor)
    gevent.spawn(archive_old_ftra_logs)

    # Emission task
    gevent.spawn(emit_hourly_data)


if __name__ == '__main__':
    logger.info("Starting Flask-SocketIO server...")
    start_scheduler()
    socketio.run(app, debug=False, host='0.0.0.0', port=5000, use_reloader=False)


