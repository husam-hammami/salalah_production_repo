import os
import logging
import webbrowser
import threading
import json
from flask import Flask, jsonify, request, render_template, redirect, url_for, flash
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from contextlib import closing
from orders_bp import orders_bp  # Import the test blueprint
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import send_from_directory
from psycopg2 import sql

# Configure logging
logging.basicConfig(filename='app.log', level=logging.DEBUG, format='%(asctime)s %(levelname)s:%(message)s')

# Initialize the Flask application
app = Flask(__name__, static_folder='frontend/dist')
app.secret_key = os.getenv('FLASK_SECRET_KEY', os.urandom(24))
CORS(app,supports_credentials=True, origins=["http://localhost:5000","http://localhost:5173"])  

# 1) Register the blueprint first
app.register_blueprint(orders_bp, url_prefix='/orders')

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
def get_db_connection():
    conn = psycopg2.connect(
        dbname='Dynamic_DB_Hercules',
        user='postgres',
        password='trust',
        host='localhost',
        port=5432,
        cursor_factory=RealDictCursor  # Set default cursor factory
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
@login_required
@handle_db_errors
def add_user():

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

@app.route('/assign-bin', methods=['POST'])
@login_required
@handle_db_errors
def assign_bin():
    data = request.get_json()
    bin_id = data.get('binId')
    material_id = data.get('materialId')

    if not bin_id or not material_id:
        return jsonify({'error': 'Missing data'}), 400

    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute('UPDATE bins SET material_id = %s WHERE id = %s', (material_id, bin_id))
        conn.commit()
    return jsonify({'status': 'success'}), 200

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
@login_required
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

        return jsonify({'kpis': kpis, 'recipes': recipes})

# Load a specific recipe and its fields for a job type
@app.route('/load-recipe/<int:recipe_id>', methods=['GET'])
@login_required
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
    kpis = data.get('kpis')    

    if not job_type_id or not recipe_name or not kpis:
        return jsonify({'error': 'Missing required data'}), 400

    # Convert IDs to integers
    try:
        job_type_id = int(job_type_id)        
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid jobTypeId'}), 400

    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()

        try:
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
            conn.rollback()
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

        cursor.execute('''
            INSERT INTO orders (job_type_id, recipe_id, order_name, kpis, order_sources, order_destinations)
            VALUES (%s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb)
            RETURNING id
        ''', (job_type_id, recipe_id, order_name, json.dumps(kpis), json.dumps(order_sources), json.dumps(order_destinations)))
        order_id = cursor.fetchone()['id']

        conn.commit()
        return jsonify({'status': 'success', 'orderId': order_id})

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
    unit = data.get('kpiUnit')  # New Field
    read_write = data.get('kpiAccessType', 'RW')  # 'R', 'W', or 'RW'

    # Validation
    if not job_type_id or not kpi_name or not data_type:
        return jsonify({'error': 'Missing required fields.'}), 400

    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO kpi_definitions (job_type_id, kpi_name, data_type, default_value, db_offset, read_write, unit)
            VALUES (%s, %s, %s, %s::jsonb, %s, %s, %s)
        ''', (job_type_id, kpi_name, data_type, json.dumps(default_value), db_offset, read_write, unit))
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
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, kpi_name, data_type, default_value, db_offset, read_write, unit
            FROM kpi_definitions
            WHERE job_type_id = %s
        ''', (job_type_id,))
        kpis = cursor.fetchall()
        return jsonify(kpis)

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

# Open browser automatically when the app starts
browser_opened = False

def open_browser():
    webbrowser.open_new('http://127.0.0.1:5000/')

if __name__ == '__main__':
    # Check if this is the reloader process
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
        threading.Timer(1.25, open_browser).start()
    app.run(debug=True)
