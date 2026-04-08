import os
import logging
import threading
import json
import struct
import psycopg2
import psycopg2.extras
import snap7
from snap7.util import set_bool, get_bool
from flask import Blueprint, jsonify, request, render_template
from contextlib import closing
from flask_login import current_user
from flask import request, redirect, url_for
from datetime import datetime
from psycopg2.extras import RealDictCursor
from contextlib import closing

# =============================================================================
# Logging Configuration
# =============================================================================
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
import sys

handler = logging.StreamHandler(sys.stdout)  # ✅ Send logs to stdout
handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
logger.addHandler(handler)
# =============================================================================
# Blueprint Initialization
# =============================================================================
orders_bp = Blueprint('orders_bp', __name__)

# ✅ OPTIMIZATION: Persistent PLC Connection for API endpoints
class SharedPLCConnection:
    """Shared persistent PLC connection with reconnection logic"""
    
    def __init__(self, ip='192.168.23.11', rack=0, slot=3):
        self.ip = ip
        self.rack = rack
        self.slot = slot
        self.client = None
        self.connected = False
        self._lock = threading.Lock()  # Thread-safe
        
    def get_client(self):
        """Get connected PLC client, reconnecting if needed"""
        with self._lock:
            # Check if connection exists and is healthy
            if self.client and self.connected:
                try:
                    # Quick health check
                    self.client.get_cpu_state()
                    return self.client
                except:
                    logger.warning("⚠️ PLC connection lost, reconnecting...")
                    self.connected = False
            
            # Need to (re)connect
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
                logger.info(f"✅ PLC connected (persistent): {self.ip}")
                return self.client
            except Exception as e:
                logger.error(f"❌ PLC connection failed: {e}")
                self.connected = False
                raise

# Create shared PLC connection instance
shared_plc = SharedPLCConnection()

def connect_to_plc_fast():
    """Get persistent PLC connection (fast, no reconnect overhead)"""
    return shared_plc.get_client()

@orders_bp.before_request
def skip_auth_for_power_monitor():
    open_endpoints = {
        'orders_bp.get_active_bin_order_data',
        'orders_bp.read_power_monitor_data',
        'orders_bp.get_db2099_report',
        'orders_bp.read_db199_monitor',
        'orders_bp.db299_monitor',
        'orders_bp.read_db499_and_db2099_monitor',
        'orders_bp.ftra_monitor',
        'orders_bp.get_fcl_latest',
        'orders_bp.get_fcl_full',
        'orders_bp.get_scl_latest',
        'orders_bp.get_scl_full',
        'orders_bp.get_latest_mila_archive',
        'orders_bp.get_all_mila_archive',
        'orders_bp.get_mila_archive_summary',
        'orders_bp.get_scl_archive_summary',
        'orders_bp.get_fcl_summary',
        'orders_bp.get_latest_10_mila_archive',
        'orders_bp.store_energy_reading',           # ✅ Energy reading storage
        'orders_bp.store_energy_readings_batch',    # ✅ Batch energy reading storage
        'orders_bp.get_energy_history'              # ✅ Energy history retrieval
    }

    if request.endpoint in open_endpoints:
        return  # Allow unauthenticated access

    if not current_user.is_authenticated:
        return redirect(url_for('login'))

# =============================================================================
# Database Connection & Helper Functions
# =============================================================================
def get_db_connection():
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        database='Dynamic_DB_Hercules',
        user='postgres',
        password='trust',
        port=5432
    )
    return conn


def get_db_number_for_job_type(job_type_id):
    """Returns the dynamic DB number for a given job type id."""
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute("SELECT db_number FROM job_types WHERE id = %s", (job_type_id,))
            result = cursor.fetchone()
            if result and "db_number" in result:
                return result['db_number']
    return None

def handle_db_errors(f):
    """Decorator to handle database and general exceptions."""
    def wrapper_func(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except psycopg2.Error as e:
            logger.error(f"Database error: {e}")
            return jsonify({'error': 'A database error occurred.'}), 500
        except Exception as e:
            logger.error(f"Unexpected error: {e}", exc_info=True)
            return jsonify({'error': 'An unexpected error occurred.'}), 500

    wrapper_func.__name__ = f.__name__
    return wrapper_func


# =============================================================================
# Energy Table Creation
# =============================================================================

def create_energy_table():
    """Create energy_readings table if it doesn't exist"""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS energy_readings (
                        id SERIAL PRIMARY KEY,
                        block_name VARCHAR(10) NOT NULL,
                        total_active_energy REAL NOT NULL,
                        total_reactive_energy REAL NOT NULL,
                        total_apparent_energy REAL NOT NULL,
                        voltage_l1_l2 REAL NOT NULL,
                        voltage_l1 REAL,
                        voltage_l2 REAL,
                        voltage_l3 REAL,
                        average_voltage REAL,
                        effective_power REAL NOT NULL,
                        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                        CONSTRAINT check_block_name CHECK (block_name IN ('C2', 'M20', 'M21', 'M22', 'M23', 'M24'))
                    );

                    -- Add new columns if they don't exist (for existing tables)
                    DO $$ 
                    BEGIN
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                     WHERE table_name='energy_readings' AND column_name='voltage_l1') THEN
                            ALTER TABLE energy_readings ADD COLUMN voltage_l1 REAL;
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                     WHERE table_name='energy_readings' AND column_name='voltage_l2') THEN
                            ALTER TABLE energy_readings ADD COLUMN voltage_l2 REAL;
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                     WHERE table_name='energy_readings' AND column_name='voltage_l3') THEN
                            ALTER TABLE energy_readings ADD COLUMN voltage_l3 REAL;
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                     WHERE table_name='energy_readings' AND column_name='average_voltage') THEN
                            ALTER TABLE energy_readings ADD COLUMN average_voltage REAL;
                        END IF;
                    END $$;

                    -- Update existing records to populate voltage_l1 from voltage_l1_l2 (backward compatibility)
                    UPDATE energy_readings 
                    SET voltage_l1 = voltage_l1_l2 
                    WHERE voltage_l1 IS NULL AND voltage_l1_l2 IS NOT NULL;

                    CREATE INDEX IF NOT EXISTS idx_energy_timestamp ON energy_readings(timestamp DESC);
                    CREATE INDEX IF NOT EXISTS idx_energy_block_name ON energy_readings(block_name);
                    CREATE INDEX IF NOT EXISTS idx_energy_block_timestamp ON energy_readings(block_name, timestamp DESC);
                """)
                conn.commit()

        logger.info("✅ Energy readings table created/verified successfully")

    except Exception as e:
        logger.error(f"❌ Error creating energy_readings table: {e}")


# Call this function when the blueprint is loaded
create_energy_table()


# =============================================================================
# PLC Communication – Helper Functions & Structures
# =============================================================================

# Map of allowed commands (bit positions) for the “AllowControl” structure
allow_bits_map = {
    "Start":         (0, 0),
    "Stop":          (0, 1),
    "Abort":         (0, 2),
    "Hold":          (0, 3),
    "Resume":        (0, 4),
    "Reset":         (0, 5),
    "UpdateLine":    (0, 6),
    "EnableFeeding": (0, 7),
    "NextReceiver":  (1, 0),
    "E-Stop":        (1, 1),
}

def connect_to_plc(ip_address='192.168.23.11', rack=0, slot=3):
    """Connect to the PLC using snap7 and return the client."""
    plc = snap7.client.Client()
    try:
        plc.connect(ip_address, rack, slot)
        if not plc.get_connected():
            raise Exception("Failed to connect to the PLC.")
    except Exception as e:
        logger.error(f"Error connecting to PLC: {e}")
        plc.destroy()
        raise
    return plc

def safe_int(val, default=0):
    try:
        return int(val)
    except (ValueError, TypeError):
        return default

def read_allow_control_bits(db_number):
    """Reads the Hercules_AllowControl bits from the specified DB."""
    start_offset = 524 # was 552 to 524
    plc = connect_to_plc_fast()  # ✅ Use persistent connection (no disconnect needed)
    data = plc.db_read(db_number, start_offset, 2)
    result = {}
    for cmd, (byte_i, bit_i) in allow_bits_map.items():
        result[cmd] = get_bool(data, byte_i, bit_i)
    return result

def send_command_to_plc(command_name, value, db_number):
    """
    Writes the specified command bit to the PLC.
    The db_number is passed dynamically.
    """
    plc = connect_to_plc_fast()  # ✅ Use persistent connection
    command_offsets = {
        'Start':         (0, 0),
        'Stop':          (0, 1),
        'Abort':         (0, 2),
        'Hold':          (0, 3),
        'Resume':        (0, 4),
        'Reset':         (0, 5),
        'UpdateLine':    (0, 6),
        'EnableFeeding': (0, 7),
        'NextReceiver':  (1, 0),
        'E-Stop':        (1, 1),
    }
    if command_name not in command_offsets:
        raise ValueError(f"Unknown command: {command_name}")
    start_address, bit_offset = command_offsets[command_name]
    data = plc.db_read(db_number, start_address, 1)
    set_bool(data, 0, bit_offset, value)
    plc.db_write(db_number, start_address, data)
    # plc.disconnect()  # ✅ No disconnect - keeping persistent connection

def write_active_order_to_plc(order, db):
    logger.info(f"Writing ACTIVE ORDER to DB{db}")
    logger.debug(json.dumps(order, indent=2, default=str))
    plc = connect_to_plc_fast()  # ✅ Persistent connection

    if 'feeders' in order:
        # Handle feeder orders
        for i, feeder in enumerate(order.get('feeders', [])):
            offset = 2 + i * 42  # Customize offset base as needed
            write_feeder_struct(plc, db, offset, feeder)
        
        # Write KPI values if defined
        kpis = order.get('kpis', {})
        defs = order.get('kpi_definitions', [])
        if isinstance(kpis, list):
            kpis = {item['kpi_name']: item.get('value') for item in kpis}

        for k in defs:
            name = k['kpi_name']
            val = kpis.get(name, k.get('default_value', 0))
            offset = k['db_offset']
            bit_offset = k.get('bit_value', 0)
            write_kpi_to_plc(plc, db, offset, val, k['data_type'], name, bit_offset)

        # Write product and stop options
        write_product_struct(plc, db, 484, order)
        write_stop_options_struct(plc, db, 684, order.get('stop_options', {}))

    else:
        # Existing flow for normal orders
        for i in range(1, 7):
            offset = 22 + (i - 1) * 42
            dest = next((d for d in order.get('order_destinations', []) if d.get('destination_number') == i), None)
            if dest:
                write_destination_struct(plc, db, offset, dest)
            else:
                clear_destination_struct(plc, db, offset)

        for i in range(1, 6):
            offset = 254 + (i - 1) * 46
            src = next((s for s in order.get('order_sources', []) if s.get('source_number') == i), None)
            if src:
                write_source_struct(plc, db, offset, src)
            else:
                clear_source_struct(plc, db, offset)

        write_product_struct(plc, db, 484, order)
        write_stop_options_struct(plc, db, 684, order.get('stop_options', {}))

        kpis = order.get('kpis', {})
        defs = order.get('kpi_definitions', [])
        if isinstance(kpis, list):
            kpis = {item['kpi_name']: item.get('value') for item in kpis}

        for k in defs:
            name = k['kpi_name']
            val = kpis.get(name, k.get('default_value', 0))
            offset = k['db_offset']
            bit_offset = k.get('bit_value', 0)
            write_kpi_to_plc(plc, db, offset, val, k['data_type'], name, bit_offset)

    # plc.disconnect()  # ✅ No disconnect - keeping persistent connection
    logger.info(f"Finished writing ACTIVE ORDER to DB{db}")


# --- PLC Data Structure Helpers ---

def write_feeder_struct(plc, db, offset, feeder):
    logger.debug(f"Writing FEEDER at DB{db} OFFSET {offset}: {feeder}")
    
    # Activate the struct
    first_byte = plc.db_read(db, offset, 1)
    set_bool(first_byte, 0, 0, True)
    plc.db_write(db, offset, first_byte)

    # Write bin_id (INT), prd_code (INT), and prd_name (STRING)
    bin_id = safe_int(feeder.get('bin_id'))
    prd_code = safe_int(feeder.get('prd_code'))
    prd_name = feeder.get('prd_name', '')

    plc.db_write(db, offset + 2, struct.pack('<h', bin_id))         # 2 bytes
    plc.db_write(db, offset + 4, struct.pack('<i', prd_code))       # 4 bytes
    write_string_s7(plc, db, offset + 8, prd_name, 32)              # STRING[32]


def write_destination_struct(plc, db, offset, dest):
    logger.debug(f"Writing DEST at DB{db} OFFSET {offset}: {dest}")
    
    # MatCode (DInt = 4 bytes) at offset +0
    prd_code = safe_int(dest.get('prd_code'))
    plc.db_write(db, offset + 0, struct.pack('<i', prd_code))  # ✅ Correct

    # MatName (STRING[25]) at offset +4
    prd_name = dest.get('prd_name', '')
    write_string_s7(plc, db, offset + 4, prd_name, 25)         # ✅ Correct



def clear_destination_struct(plc, db, offset):
    logger.debug(f"Clearing DEST at DB{db} OFFSET {offset}")
    plc.db_write(db, offset + 0, struct.pack('<i', 0))   # Clear MatCode
    write_string_s7(plc, db, offset + 4, '', 25)          # Clear MatName
    first_byte = plc.db_read(db, offset, 1)
    set_bool(first_byte, 0, 0, False)
    plc.db_write(db, offset, first_byte)
    plc.db_write(db, offset + 2, struct.pack('>h', 0))
    plc.db_write(db, offset + 4, struct.pack('>i', 0))
    write_string_s7(plc, db, offset + 8, '', 32)

def write_source_struct(plc, db, offset, src):
    logger.debug(f"Writing SOURCE at DB{db} OFFSET {offset}: {src}")
    
    # Activate source at offset bit 0
    first_byte = plc.db_read(db, offset, 1)
    set_bool(first_byte, 0, 0, True)
    plc.db_write(db, offset, first_byte)

    # Write bin_id (2 bytes at offset +2) — little-endian
    bin_id = safe_int(src.get('bin_id'))
    plc.db_write(db, offset + 2, struct.pack('<h', bin_id))

    # Write qty_percent (float, 4 bytes at offset +4) — little-endian
    qty = float(src.get('qty_percent', 100.0))
    plc.db_write(db, offset + 4, struct.pack('<f', qty))

    # Write prd_name (STRING[25]) at offset +12
    prd_name = src.get('prd_name', '')
    write_string_s7(plc, db, offset + 12, prd_name, 32)



def clear_source_struct(plc, db, offset):
    logger.debug(f"Clearing SOURCE at DB{db} OFFSET {offset}")
    
    # Deactivate source
    first_byte = plc.db_read(db, offset, 1)
    set_bool(first_byte, 0, 0, False)
    plc.db_write(db, offset, first_byte)

    # Clear bin_id (2 bytes), qty_percent (4 bytes), prd_code (4 bytes)
    plc.db_write(db, offset + 2, struct.pack('<h', 0))     # bin_id
    plc.db_write(db, offset + 4, struct.pack('<f', 0.0))   # qty_percent
    plc.db_write(db, offset + 8, struct.pack('<i', 0))     # prd_code (if needed)

    # Clear product name
    write_string_s7(plc, db, offset + 12, '', 32)


def write_product_struct(plc, db, offset, order):
    logger.debug(f"Writing PRODUCT at DB{db} OFFSET {offset}: FinalProduct={order.get('final_product')}, RecipeName={order.get('recipe_name')}")
    plc.db_write(db, offset, struct.pack('>i', safe_int(order.get('final_product'))))
    write_string_s7(plc, db, offset + 4, order.get('recipe_name', ''), 32)
    byte = plc.db_read(db, offset + 38, 1)
    set_bool(byte, 0, 0, True)
    plc.db_write(db, offset + 38, byte)

def write_stop_options_struct(plc, db, offset, opts):
    logger.debug(f"Writing STOP OPTIONS at DB{db} OFFSET {offset}: {opts}")
    b = plc.db_read(db, offset, 1)
    set_bool(b, 0, 0, opts.get('job_qty', False))
    set_bool(b, 0, 1, opts.get('full_dest', False))
    set_bool(b, 0, 2, opts.get('empty_source', False))
    set_bool(b, 0, 3, opts.get('held_status', False))
    plc.db_write(db, offset, b)
    plc.db_write(db, offset + 2, struct.pack('>i', safe_int(opts.get('held_status_delay'))))
    plc.db_write(db, offset + 6, struct.pack('>i', safe_int(opts.get('auto_stop_delay'))))

def write_kpi_to_plc(plc, db, offset, value, dtype, name, bit_offset=0):
    try:
        logger.debug(f"Writing KPI '{name}' to DB{db} OFFSET {offset} BIT {bit_offset}: {value} ({dtype})")
        if dtype == 'integer':
            plc.db_write(db, offset, struct.pack('>i', int(value)))
        elif dtype == 'float':
            plc.db_write(db, offset, struct.pack('>f', float(value)))
        elif dtype == 'boolean':
            b = plc.db_read(db, offset, 1)
            set_bool(b, 0, bit_offset, bool(value))
            plc.db_write(db, offset, b)
        elif dtype == 'string':
            write_string_s7(plc, db, offset, str(value), 32)
        else:
            logger.error(f"Unsupported KPI data type: {dtype} for {name}")
    except Exception as e:
        logger.error(f"KPI write error for {name} at offset {offset}: {e}")

def write_string_s7(plc, db, offset, value, max_len):
    total_len = max_len + 2
    data = bytearray(total_len)
    data[0] = max_len
    encoded = value.encode('ascii', 'ignore')[:max_len]
    data[1] = len(encoded)
    data[2:2+len(encoded)] = encoded
    logger.debug(f"Writing STRING to DB{db} OFFSET {offset}: '{value}'")
    plc.db_write(db, offset, data)

def read_kpi_from_plc(plc, db_number, offset, data_type, kpi_name):
    try:
        if data_type == 'integer':
            data_bytes = plc.db_read(db_number, offset, 4)
            value = struct.unpack('>i', data_bytes)[0]
            return value
        elif data_type == 'float':
            data_bytes = plc.db_read(db_number, offset, 4)
            value = struct.unpack('>f', data_bytes)[0]
            return value
        elif data_type == 'boolean':
            data_bytes = plc.db_read(db_number, offset, 1)
            return data_bytes[0] != 0
        elif data_type == 'string':
            max_length = 32
            total_length = max_length + 2
            data_bytes = plc.db_read(db_number, offset, total_length)
            actual_length = data_bytes[1]
            return data_bytes[2:2+actual_length].decode('ascii', errors='ignore')
        else:
            logger.error(f"Unsupported data type for reading KPI: {data_type}")
            return None
    except Exception as e:
        logger.error(f"Error reading KPI '{kpi_name}' from PLC: {e}")
        return None
    
def generate_power_tags():
    base_tags = [
        {"block": "C2", "tag": "L1_Current", "offset": 20, "type": "REAL"},
        {"block": "C2", "tag": "L1_Voltage", "offset": 32, "type": "REAL"},
        {"block": "C2", "tag": "L2_Current", "offset": 148, "type": "REAL"},
        {"block": "C2", "tag": "L2_Voltage", "offset": 160, "type": "REAL"},
        {"block": "C2", "tag": "L3_Current", "offset": 276, "type": "REAL"},
        {"block": "C2", "tag": "L3_Voltage", "offset": 288, "type": "REAL"},
        {"block": "C2", "tag": "EffectivePower", "offset": 392, "type": "REAL"},
        {"block": "C2", "tag": "ApparentPower", "offset": 396, "type": "REAL"},
        {"block": "C2", "tag": "ReactivePower", "offset": 400, "type": "REAL"},
        {"block": "C2", "tag": "OutCosPhi", "offset": 404, "type": "REAL"},
        {"block": "C2", "tag": "Total_Active_Energy", "offset": 408, "type": "DINT", "scale": 0.01},
        {"block": "C2", "tag": "Total_Reactive_Energy", "offset": 412, "type": "DINT", "scale": 0.01},
        {"block": "C2", "tag": "Total_Apparent_Energy", "offset": 416, "type": "DINT", "scale": 0.01}
    ]

    # Correct base offsets for M-blocks
    m_blocks = {"M20": 564, "M21": 1108, "M22": 1652, "M23": 2196, "M24": 2740}

    # Adjusted relative offsets
    step_offsets = {
        "L1_Current": 0,
        "L1_Voltage": 12,
        "L2_Current": 128,
        "L2_Voltage": 140,
        "L3_Current": 256,
        "L3_Voltage": 268,
        "EffectivePower": 372,
        "ApparentPower": 376,
        "ReactivePower": 380,
        "OutCosPhi": 384,
        "Total_Active_Energy": 388,
        "Total_Reactive_Energy": 392,
        "Total_Apparent_Energy": 396
    }

    for block, base in m_blocks.items():
        for tag, offset in step_offsets.items():
            base_tags.append({
                "block": block,
                "tag": tag,
                "offset": base + offset,
                "type": "DINT" if "Energy" in tag else "REAL",
                "scale": 0.01 if "Energy" in tag else 1.0
            })

    return base_tags



# =============================================================================
# REST API Endpoints
# =============================================================================
@orders_bp.route('/read-power-monitor', methods=['GET'])
def read_power_monitor_data():
    def unpack_value(raw, dtype):
        if dtype == 'REAL':
            return struct.unpack('>f', raw)[0]
        elif dtype == 'DINT':
            return struct.unpack('>i', raw)[0]
        else:
            raise ValueError(f"Unsupported type: {dtype}")

    try:
        plc = connect_to_plc_fast()  # ✅ Persistent connection
        db_number = 1603  # Fixed DB number for power monitor
        tag_map = generate_power_tags()
        result = {}

        for tag in tag_map:
            tag_name = tag['tag']
            block = tag['block']
            full_tag = f"{block}.LGEN_{tag_name}" if any(x in tag_name for x in ["Power", "Energy", "CosPhi"]) else f"{block}.{tag_name}"

            try:
                raw = plc.db_read(db_number, tag['offset'], 4)
                value = unpack_value(raw, tag['type'])
                scale = tag.get('scale', 1.0)
                value = round(value * scale, 3)
            except Exception as e:
                value = f"Error: {e}"

            result[full_tag] = value

        # plc.disconnect()  # ✅ No disconnect - keeping persistent connection
        return jsonify({"status": "success", "data": result}), 200

    except Exception as e:
        logger.error(f"Error in read-power-monitor: {e}", exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500


@orders_bp.route('/order-management', methods=['GET'])
def order_management():
    return render_template('test_blueprint.html')

@orders_bp.route('/get-job-types', methods=['GET'])
@handle_db_errors
def get_job_types():
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute("SELECT id, name FROM job_types")
            job_types = cursor.fetchall()
            return jsonify(job_types)

@orders_bp.route('/job-types/<int:job_type_id>/recipes', methods=['GET'])
@handle_db_errors
def get_recipes(job_type_id):
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute("SELECT id, name FROM recipes WHERE job_type_id = %s", (job_type_id,))
            recipes = cursor.fetchall()
            return jsonify(recipes)

@orders_bp.route('/get-recipe-details/<int:recipe_id>', methods=['GET'])
@handle_db_errors
def get_recipe_details(recipe_id):
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute("""
                SELECT r.*, jt.name AS job_type_name, jt.id AS job_type_id
                FROM recipes r
                JOIN job_types jt ON r.job_type_id = jt.id
                WHERE r.id = %s
            """, (recipe_id,))
            recipe = cursor.fetchone()
            if not recipe:
                return jsonify({'error': 'Recipe not found'}), 404
            for key in ['kpis', 'sources', 'destinations', 'stop_options']:
                if isinstance(recipe.get(key), str):
                    try:
                        recipe[key] = json.loads(recipe[key])
                    except Exception:
                        recipe[key] = {}
            return jsonify({
                'kpi_definitions': recipe.get('kpi_definitions', []),
                'kpis': recipe.get('kpis', {}),
                'sources': recipe.get('sources', []),
                'destinations': recipe.get('destinations', []),
                'stop_options': recipe.get('stop_options', {}),
                'finalProduct': recipe.get('final_product_id'),
                'job_type_id': recipe.get('job_type_id'),
                'job_type_name': recipe.get('job_type_name')
            })

@orders_bp.route('/get-orders', methods=['GET'])
@handle_db_errors
def get_orders():
    job_type_id = request.args.get('job_type')
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            if job_type_id:
                cursor.execute("""
                    SELECT o.id, jt.name as job_type, r.name as recipe_name, o.status, o.created_at
                    FROM orders o
                    JOIN recipes r ON o.recipe_id = r.id
                    JOIN job_types jt ON o.job_type_id = jt.id
                    WHERE o.job_type_id = %s
                """, (job_type_id,))
            else:
                cursor.execute("""
                    SELECT o.id, jt.name as job_type, r.name as recipe_name, o.status, o.created_at
                    FROM orders o
                    JOIN recipes r ON o.recipe_id = r.id
                    JOIN job_types jt ON o.job_type_id = jt.id
                """)
            orders = cursor.fetchall()
            for order in orders:
                if order.get('created_at'):
                    order['created_at'] = order['created_at'].isoformat()
            return jsonify(orders)

@orders_bp.route('/get-order-details/<int:order_id>', methods=['GET'])
@handle_db_errors
def get_order_details(order_id):
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute("""
                SELECT o.*, r.name AS recipe_name, r.final_product_id,
                       jt.id AS job_type_id, jt.name AS job_type_name
                FROM orders o
                JOIN recipes r ON o.recipe_id = r.id
                JOIN job_types jt ON r.job_type_id = jt.id
                WHERE o.id = %s
            """, (order_id,))
            order = cursor.fetchone()
            if not order:
                return jsonify({'error': 'Order not found'}), 404

            for key in ['kpis', 'order_sources', 'order_destinations', 'stop_options']:
                if isinstance(order.get(key), str):
                    try:
                        order[key] = json.loads(order[key])
                    except Exception:
                        order[key] = {}

            return jsonify({
                'id': order.get('id'),
                'recipe_name': order.get('recipe_name'),
                'kpi_definitions': order.get('kpi_definitions', []),
                'kpis': order.get('kpis', {}),
                'sources': order.get('order_sources', []),
                'destinations': order.get('order_destinations', []),
                'finalProduct': order.get('final_product_id'),
                'stop_options': order.get('stop_options', {}),
                'job_type_id': order.get('job_type_id'),
                'job_type_name': order.get('job_type_name')  # ✅ Included here
            })

@orders_bp.route('/submit-order', methods=['POST'])
@handle_db_errors
def submit_order():
    data = request.get_json()
    job_type_id = data.get('job_type_id')
    recipe_id = data.get('recipe_id')
    order_name = data.get('order_name', 'Order')
    kpis = data.get('kpis', {})
    sources = data.get('sources', [])
    destinations = data.get('destinations', [])
    stop_options = data.get('stop_options', {})
    if not recipe_id or not job_type_id:
        return jsonify({'error': 'Invalid order data'}), 400
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            for s in sources:
                bin_id = s.get('bin_id')
                if bin_id:
                    cursor.execute("""
                        SELECT m.material_name, m.material_code
                        FROM bins b
                        JOIN materials m ON b.material_id = m.id
                        WHERE b.id = %s
                    """, (bin_id,))
                    row = cursor.fetchone()
                    if row:
                        s['prd_name'] = row.get('material_name')
                        try:
                            s['prd_code'] = int(row.get('material_code', 0))
                        except Exception:
                            s['prd_code'] = 0
                    else:
                        s['prd_name'] = 'UNKNOWN'
                        s['prd_code'] = 0
            for d in destinations:
                bin_id = d.get('bin_id')
                if bin_id:
                    cursor.execute("""
                        SELECT m.material_name, m.material_code
                        FROM bins b
                        JOIN materials m ON b.material_id = m.id
                        WHERE b.id = %s
                    """, (bin_id,))
                    row = cursor.fetchone()
                    if row:
                        d['prd_name'] = row.get('material_name')
                        try:
                            d['prd_code'] = int(row.get('material_code', 0))
                        except Exception:
                            d['prd_code'] = 0
                    else:
                        d['prd_name'] = 'UNKNOWN'
                        d['prd_code'] = 0
            cursor.execute("""
                INSERT INTO orders (
                    job_type_id, recipe_id, order_name,
                    kpis, order_sources, order_destinations,
                    stop_options, status
                )
                VALUES (
                    %s, %s, %s,
                    %s::jsonb, %s::jsonb, %s::jsonb,
                    %s::jsonb, 'idle'
                )
                RETURNING id
            """, (
                job_type_id,
                recipe_id,
                order_name,
                json.dumps(kpis),
                json.dumps(sources),
                json.dumps(destinations),
                json.dumps(stop_options)
            ))
            order_id = cursor.fetchone()['id']
            conn.commit()
    return jsonify({'message': 'Order submitted successfully', 'order_id': order_id}), 200

@orders_bp.route('/update-order/<int:order_id>', methods=['POST'])
@handle_db_errors
def update_order(order_id):
    data = request.get_json()
    kpis = data.get('kpis', {})
    sources = data.get('sources', [])
    destinations = data.get('destinations', [])
    stop_options = data.get('stop_options', {})
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                UPDATE orders
                SET kpis = %s::jsonb, order_sources = %s::jsonb, order_destinations = %s::jsonb, stop_options = %s::jsonb
                WHERE id = %s
            """, (
                json.dumps(kpis),
                json.dumps(sources),
                json.dumps(destinations),
                json.dumps(stop_options),
                order_id
            ))
            conn.commit()
    return jsonify({'message': 'Order updated successfully'}), 200

@orders_bp.route('/duplicate-order/<int:order_id>', methods=['POST'])
@handle_db_errors
def duplicate_order(order_id):
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cursor:
            cursor.execute("SELECT * FROM orders WHERE id = %s", (order_id,))
            order = cursor.fetchone()
            if not order:
                return jsonify({'error': 'Order not found'}), 404
            cursor.execute("""
                INSERT INTO orders (job_type_id, recipe_id, order_name, kpis, order_sources, order_destinations, stop_options, status)
                VALUES (%s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb, 'idle')
                RETURNING id
            """, (
                order['job_type_id'],
                order['recipe_id'],
                order['order_name'] + ' Copy',
                json.dumps(order['kpis']),
                json.dumps(order['order_sources']),
                json.dumps(order['order_destinations']),
                json.dumps(order['stop_options'])
            ))
            new_order_id = cursor.fetchone()[0]
            conn.commit()
    return jsonify({'message': 'Order duplicated successfully', 'new_order_id': new_order_id}), 200

@orders_bp.route('/delete-order/<int:order_id>', methods=['DELETE'])
@handle_db_errors
def delete_order(order_id):
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM orders WHERE id = %s", (order_id,))
            conn.commit()
    return jsonify({'message': 'Order deleted successfully'}), 200

@orders_bp.route('/bins/material/<int:material_id>', methods=['GET'])
@handle_db_errors
def get_bins_for_material(material_id):
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute("""
                SELECT id AS bin_id, bin_name
                FROM bins
                WHERE material_id = %s
            """, (material_id,))
            bins = cursor.fetchall()
            if bins:
                return jsonify(bins)
            else:
                return jsonify({'error': 'No bins found for the selected material'}), 404
@orders_bp.route('/release-order/<int:order_id>', methods=['POST'])
@handle_db_errors
def release_order(order_id):
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            # Fetch clicked order's current status and job type
            cursor.execute("SELECT job_type_id, status FROM orders WHERE id = %s", (order_id,))
            order_data = cursor.fetchone()
            if not order_data:
                return jsonify({'error': 'Order not found'}), 404

            job_type_id = order_data['job_type_id']
            current_status = order_data['status']
            db_number = get_db_number_for_job_type(job_type_id)

            if db_number is None:
                return jsonify({'error': 'Invalid job type DB mapping'}), 500

            # Case 1: If it's currently active → make it idle
            if current_status == 'active':
                cursor.execute("""
                    UPDATE orders
                    SET status = 'idle', released_at = NULL
                    WHERE id = %s
                """, (order_id,))
                conn.commit()
                return jsonify({'message': 'Order set to idle', 'status': 'idle'}), 200

            # Case 2: If it's queued → make it idle
            if current_status == 'queued':
                cursor.execute("""
                    UPDATE orders
                    SET status = 'idle', released_at = NULL
                    WHERE id = %s
                """, (order_id,))
                conn.commit()
                return jsonify({'message': 'Queued order cancelled and set to idle', 'status': 'idle'}), 200

            # Case 3: If it's idle → make it active, and demote any active one to queued
            if current_status == 'idle':
                # Demote any currently active order for this job type to queued
                cursor.execute("""
                    UPDATE orders
                    SET status = 'queued', released_at = NOW()
                    WHERE status = 'active' AND job_type_id = %s
                """, (job_type_id,))

                # Promote this order to active
                cursor.execute("""
                    UPDATE orders
                    SET status = 'active', released_at = NOW()
                    WHERE id = %s
                """, (order_id,))
                conn.commit()

                # Optionally: Push this order to PLC (same as before)
                # Fetch order & write logic (unchanged)
                # ...
                
                return jsonify({'message': 'Order activated', 'status': 'active'}), 200

            return jsonify({'message': 'No action taken'}), 200


@orders_bp.route('/cancel-active-order', methods=['POST'])
@handle_db_errors
def cancel_active_order():
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute("""
                UPDATE orders
                SET status = %s, released_at = NULL
                WHERE status = %s
            """, ('idle', 'active'))
            cursor.execute("""
                SELECT id FROM orders
                WHERE status = %s
                ORDER BY released_at ASC
                LIMIT 1
            """, ('queued',))
            next_queued_order = cursor.fetchone()
            if next_queued_order:
                next_order_id = next_queued_order['id']
                cursor.execute("""
                    UPDATE orders
                    SET status = %s, released_at = NOW()
                    WHERE id = %s
                """, ('active', next_order_id))
                conn.commit()
                cursor.execute("""
                    SELECT o.*, r.name AS recipe_name, r.final_product_id, jt.id AS job_type_id
                    FROM orders o
                    JOIN recipes r ON o.recipe_id = r.id
                    JOIN job_types jt ON r.job_type_id = jt.id
                    WHERE o.id = %s
                """, (next_order_id,))
                active_order = cursor.fetchone()
                if active_order:
                    cursor.execute("""
                        SELECT kpi_name, data_type, default_value, db_offset
                        FROM kpi_definitions
                        WHERE job_type_id = %s
                    """, (active_order['job_type_id'],))
                    kpi_definitions = cursor.fetchall()
                    active_order['kpi_definitions'] = kpi_definitions
                    db_number = get_db_number_for_job_type(active_order['job_type_id']) 
                    write_active_order_to_plc(active_order, db_number)
                else:
                    logger.error(f"Active order with ID {next_order_id} not found after activation.")
            else:
                logger.info("No queued order to activate.")
            conn.commit()
    return jsonify({'message': 'Active order canceled, and next queued order (if any) is now active'}), 200
@orders_bp.route('/get-active-order', methods=['GET'])
@handle_db_errors
def get_active_order():
    job_type_id = request.args.get('job_type_id', type=int)
    if job_type_id is None:
        return jsonify({'error': 'job_type_id parameter is required'}), 400

    try:
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:

                # 1) Fetch the active order from the orders table
                cursor.execute("""
                    SELECT o.*, r.name AS recipe_name, r.final_product_id,
                           jt.id AS job_type_id, jt.name AS job_type_name
                    FROM orders o
                    JOIN recipes r ON o.recipe_id = r.id
                    JOIN job_types jt ON r.job_type_id = jt.id
                    WHERE o.status = %s
                      AND jt.id = %s
                """, ('active', job_type_id))
                active_order = cursor.fetchone()

                if not active_order:
                    return jsonify({'error': 'No active order found for this job type'}), 404

                # 2) Fetch KPI definitions (including read_write)
                cursor.execute("""
                    SELECT kpi_name, data_type, default_value, db_offset, read_write
                    FROM kpi_definitions
                    WHERE job_type_id = %s
                """, (active_order['job_type_id'],))
                kpi_definitions = cursor.fetchall()

                # Strip whitespace from each KPI name
                for kd in kpi_definitions:
                    if kd['kpi_name']:
                        kd['kpi_name'] = kd['kpi_name'].strip()

                # 3) Fetch all bin names in a dictionary for quick lookup
                cursor.execute("SELECT id, bin_name FROM bins")
                bin_name_map = {bin['id']: bin['bin_name'] for bin in cursor.fetchall()}

                # 4) Extract Sources from Active Order JSON
                sources = active_order.get('order_sources', [])
                formatted_sources = []
                for src in sources:
                    bin_id = src.get('bin_id', 'N/A')
                    bin_name = bin_name_map.get(bin_id, 'Unknown')  # Get bin name using bin_id
                    formatted_sources.append({
                        'bin_id': bin_id,
                        'source_number': src.get('source_number', 'N/A'),
                        'prd_code': src.get('prd_code', 'N/A'),
                        'prd_name': src.get('prd_name', 'Unknown'),
                        'bin_name': bin_name  # Include bin name for sources
                    })

                # 5) Extract Destinations from Active Order JSON
                destinations = active_order.get('order_destinations', [])
                formatted_destinations = []
                for dest in destinations:
                    bin_id = dest.get('bin_id', 'N/A')
                    bin_name = bin_name_map.get(bin_id, 'Unknown')  # Get bin name using bin_id
                    formatted_destinations.append({
                        'bin_id': bin_id,
                        'destination_number': dest.get('destination_number', 'N/A'),
                        'prd_code': dest.get('prd_code', 'N/A'),
                        'prd_name': dest.get('prd_name', 'Unknown'),
                        'bin_name': bin_name  # Include bin name for destinations
                    })

                # 6) Parse JSON fields (kpis, stop_options)
                for key in ['kpis', 'stop_options']:
                    if isinstance(active_order.get(key), str):
                        try:
                            active_order[key] = json.loads(active_order[key])
                        except Exception:
                            active_order[key] = {}

                # 7) Convert KPIs to dictionary format
                if isinstance(active_order.get('kpis'), list):
                    active_order['kpis'] = {
                        item.get('kpi_name', '').strip(): item
                        for item in active_order['kpis']
                        if item.get('kpi_name')
                    }

                # 8) Build final response
                response_data = {
                    'id': active_order.get('id'),
                    'recipe_name': active_order.get('recipe_name'),
                    'kpi_definitions': kpi_definitions,
                    'kpis': active_order.get('kpis', {}),
                    'sources': formatted_sources,
                    'destinations': formatted_destinations,
                    'finalProduct': active_order.get('final_product_id'),
                    'stop_options': active_order.get('stop_options', {}),
                    'status': active_order.get('status'),
                    'created_at': (
                        active_order['created_at'].isoformat()
                        if active_order.get('created_at') else None
                    ),
                    'job_type': active_order.get('job_type_name')
                }

                return jsonify(response_data), 200

    except Exception as e:
        print(f"Unhandled error in get_active_order: {e}")
        return jsonify({'error': 'Internal Server Error', 'message': str(e)}), 500


@orders_bp.route('/send-command', methods=['POST'])
def send_command():
    try:
        data = request.json
        command_name = data.get('command')
        job_type_id = data.get('job_type_id')

        if not command_name:
            return jsonify({'success': False, 'error': 'No command provided'}), 400
        if job_type_id is None:
            return jsonify({'success': False, 'error': 'No job_type_id provided'}), 400

        # ✅ Fetch correct DB number for job_type
        db_number = get_db_number_for_job_type(job_type_id)
        if db_number is None:
            return jsonify({'success': False, 'error': 'Invalid job_type_id or missing DB mapping'}), 400

        allow_bits = read_allow_control_bits(db_number)
        if command_name not in allow_bits:
            return jsonify({'success': False, 'error': f'Unknown command: {command_name}'}), 400
        if not allow_bits[command_name]:
            return jsonify({'success': False, 'error': f'{command_name} not currently allowed by PLC.'}), 403

        send_command_to_plc(command_name, True, db_number)
        threading.Timer(1.0, send_command_to_plc, args=(command_name, False, db_number)).start()

        return jsonify({'success': True, 'message': f'{command_name} command sent to PLC'}), 200

    except Exception as e:
        logger.error(f"Error sending command to PLC: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500




@orders_bp.route('/plc-monitor', methods=['GET'])
def read_plc_monitor():
    try:
        # Optionally, a job_type_id may be provided to get the dynamic DB number
        job_type_id = request.args.get('job_type_id', type=int)
        db_number = get_db_number_for_job_type(job_type_id) 
        plc = connect_to_plc_fast()  # ✅ Persistent connection
        # 1) Read AllowControl bits
        allow_data = plc.db_read(db_number, 524, 2) # from 552 to 524
        allow_bits = {}
        for cmd, (byte_i, bit_i) in allow_bits_map.items():
            allow_bits[cmd] = get_bool(allow_data, byte_i, bit_i)
        # 2) Read Run/Idle bits at DBX554
        run_idle_data = plc.db_read(db_number, 526, 1) # from 554 to 526
        run_bit = get_bool(run_idle_data, 0, 0)
        idle_bit = get_bool(run_idle_data, 0, 1)
        # 3) Read Active Destination struct
        dest_no_bytes = plc.db_read(db_number, 528, 2) # from 556 to 528
        dest_no = struct.unpack('>h', dest_no_bytes)[0]
        dest_bin_id_bytes = plc.db_read(db_number, 530, 2) # from 558 to 530
        dest_bin_id = struct.unpack('>h', dest_bin_id_bytes)[0]
        prd_code_bytes = plc.db_read(db_number, 532, 4) # from 560 to 532
        active_dest_prd_code = struct.unpack('>i', prd_code_bytes)[0]
        # 4) Read WaterConsumed & ProducedWeight
        
        wc_bytes = plc.db_read(db_number, 564, 4)
        water_consumed = struct.unpack('>f', wc_bytes)[0]

        pw_bytes = plc.db_read(db_number, 568, 4)
        produced_weight = struct.unpack('>f', pw_bytes)[0]
        ## Note KPI to be fixed Dynamic not Static, @Imroz
        
        ##

        # 5) Read Active Sources (assumed 5 sources with known offsets)
        sources_data = []
        base_offsets = [563, 525, 568, 584, 600]  # was 572, 588, 604, 620, 636
        for i, base in enumerate(base_offsets, start=1):
            active_byte = plc.db_read(db_number, base, 1)
            source_active = get_bool(active_byte, 0, 0)
            bin_id_bytes = plc.db_read(db_number, base+2, 2)
            bin_id_val = struct.unpack('>h', bin_id_bytes)[0]
            qty_percent_bytes = plc.db_read(db_number, base+4, 4)
            qty_percent_val = struct.unpack('>f', qty_percent_bytes)[0]
            produced_qty_bytes = plc.db_read(db_number, base+8, 4)
            produced_qty_val = struct.unpack('>f', produced_qty_bytes)[0]
            prd_code_bytes = plc.db_read(db_number, base+12, 4)
            prd_code_val = struct.unpack('>i', prd_code_bytes)[0]
            sources_data.append({
                'source_index': i,
                'active': source_active,
                'bin_id': bin_id_val,
                'qty_percent': qty_percent_val,
                'produced_qty': produced_qty_val,
                'prd_code': prd_code_val
            })
        # 6) Read OS_Comment (Siemens string)
        comment_data = plc.db_read(db_number, 616, 66) # 652 to 616
        max_len = comment_data[0]
        actual_len = comment_data[1]
        os_comment = comment_data[2:2+actual_len].decode('ascii', errors='ignore') if actual_len <= max_len else ''
        # 7) Read JobStatus.Code (INT)
        job_code_bytes = plc.db_read(db_number, 682, 2) #from 718 to 682
        job_code = struct.unpack('>h', job_code_bytes)[0]
        # plc.disconnect()  # ✅ No disconnect - keeping persistent connection
        response = {
            "allowControl": allow_bits,
            "Run": run_bit,
            "Idle": idle_bit,
            "ActiveDest": {
                "dest_no": dest_no,
                "dest_bin_id": dest_bin_id,
                "prd_code": active_dest_prd_code,
            },
            "WaterConsumed": water_consumed,
            "ProducedWeight": produced_weight,
            "ActiveSources": sources_data,
            "OS_Comment": os_comment,
            "JobStatusCode": job_code,
        }
        logger.info(f"... read_plc_monitor => {json.dumps(response, indent=2)}")
        return jsonify(response), 200
    except Exception as e:
        logger.error(f"Error reading PLC monitor data: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@orders_bp.route('/read-active-kpis', methods=['GET'])
def read_active_kpis():
    try:
        job_type_id = request.args.get('job_type_id', type=int)
        if not job_type_id:
            return jsonify({'error': 'job_type_id is required'}), 400
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                cursor.execute("""
                    SELECT id
                    FROM orders
                    WHERE job_type_id = %s
                      AND status = 'active'
                    LIMIT 1
                """, (job_type_id,))
                active_order = cursor.fetchone()
                if not active_order:
                    return jsonify({'error': 'No active order found for this job type'}), 404
                order_id = active_order['id']
                cursor.execute("""
                    SELECT kpi_name, data_type, db_offset
                    FROM kpi_definitions
                    WHERE job_type_id = %s
                      AND read_write = 'R'
                """, (job_type_id,))
                kpi_defs = cursor.fetchall()
                logger.info(f"Found R-type KPI defs: {kpi_defs}")
        plc = connect_to_plc_fast()  # ✅ Persistent connection
        db_number = get_db_number_for_job_type(job_type_id)
        kpi_results = []
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                for kd in kpi_defs:
                    kpi_name  = kd['kpi_name']
                    data_type = kd['data_type']
                    offset    = kd.get('db_offset')
                    if offset is None:
                        continue
                    value = read_kpi_from_plc(plc, db_number, offset, data_type, kpi_name)
                    cursor.execute("""
                        INSERT INTO kpi_readings (order_id, kpi_name, kpi_value, data_type, db_offset)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (order_id, kpi_name, str(value), data_type, offset))
                    kpi_results.append({
                        'kpi_name':  kpi_name,
                        'value':     value,
                        'data_type': data_type,
                        'offset':    offset
                    })
                conn.commit()
        # plc.disconnect()  # ✅ No disconnect - keeping persistent connection
        return jsonify({'order_id': order_id, 'kpis': kpi_results}), 200
    except Exception as e:
        logger.error(f"Error in read_active_kpis: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


# ----------------------------------------------------Feeder Order APIs--------------------------------------------------

@orders_bp.route('/feeder-orders/create', methods=['POST'])
@handle_db_errors
def create_feeder_order():
    data = request.get_json()
    job_type_id = data['jobTypeId']
    recipe_id = data['recipeId']
    order_name = data['orderName']
    kpis = data.get('kpis', [])
    feeders = data.get('feeders', [])
    stop_options = data.get('stopOptions', {})

    # Enrich feeders with material_name from DB
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Build material map from DB
        cursor.execute("SELECT id, material_name FROM materials")
        material_map = {row['id']: row['material_name'] for row in cursor.fetchall()}

        enriched_feeders = []
        for feeder in feeders:
            material_id = feeder.get('material_id')
            material_name = feeder.get('material_name') or material_map.get(material_id, 'Unnamed')
            enriched_feeders.append({
                **feeder,
                'material_id': material_id,
                'material_name': material_name
            })

        # Insert enriched order
        cursor.execute('''
            INSERT INTO feeder_orders (
                job_type_id, recipe_id, order_name, kpis, feeders, stop_options
            ) VALUES (
                %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb
            )
            RETURNING id
        ''', (
            job_type_id, recipe_id, order_name,
            json.dumps(kpis), json.dumps(enriched_feeders), json.dumps(stop_options)
        ))
        order_id = cursor.fetchone()['id']
        conn.commit()

    return jsonify({'status': 'success', 'orderId': order_id}), 201



@orders_bp.route('/feeder-orders/details/<int:order_id>', methods=['GET'])
@handle_db_errors
def get_feeder_order_details(order_id):
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute('''
            SELECT fo.*, fr.name AS recipe_name
            FROM feeder_orders fo
            JOIN feeder_recipes fr ON fo.recipe_id = fr.id
            WHERE fo.id = %s
        ''', (order_id,))
        order = cursor.fetchone()
        if order:
            return jsonify(order)
        return jsonify({'error': 'Order not found'}), 404


@orders_bp.route('/feeder-orders/release/<int:order_id>', methods=['POST'])
@handle_db_errors
def release_feeder_order(order_id):
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # 1. Fetch the order
        cursor.execute('''
            SELECT fo.*, fr.name AS recipe_name
            FROM feeder_orders fo
            JOIN feeder_recipes fr ON fo.recipe_id = fr.id
            WHERE fo.id = %s
        ''', (order_id,))
        order = cursor.fetchone()
        if not order:
            return jsonify({'error': 'Order not found'}), 404

        job_type_id = order['job_type_id']
        current_status = order['status']

        # 2. Get DB number
        cursor.execute('SELECT db_number FROM job_types WHERE id = %s', (job_type_id,))
        db_info = cursor.fetchone()
        if not db_info:
            return jsonify({'error': 'DB number not found'}), 500
        db_number = db_info['db_number']

        # 3. Toggle logic
        if current_status == 'active':
            # Deactivate (set to idle)
            cursor.execute('''
                UPDATE feeder_orders
                SET status = 'idle', released_at = NULL
                WHERE id = %s
            ''', (order_id,))
            conn.commit()
            return jsonify({'message': 'Order set to idle', 'status': 'idle'}), 200

        elif current_status == 'queued':
            # Cancel queued order
            cursor.execute('''
                UPDATE feeder_orders
                SET status = 'idle', released_at = NULL
                WHERE id = %s
            ''', (order_id,))
            conn.commit()
            return jsonify({'message': 'Queued order cancelled', 'status': 'idle'}), 200

        elif current_status == 'idle':
            # Demote any active order of same job type to queued
            cursor.execute('''
                UPDATE feeder_orders
                SET status = 'queued', released_at = NOW()
                WHERE status = 'active' AND job_type_id = %s
            ''', (job_type_id,))

            # Activate selected order
            cursor.execute('''
                UPDATE feeder_orders
                SET status = 'active', released_at = NOW()
                WHERE id = %s
            ''', (order_id,))
            conn.commit()

            # Write to PLC only after activation
            write_active_order_to_plc({
                'feeders': order['feeders'],
                'kpi_definitions': [],  # You may update this
                'kpis': order['kpis'],
                'final_product': order['recipe_id'],
                'recipe_name': order['recipe_name'],
                'stop_options': order['stop_options']
            }, db_number)

            return jsonify({'message': 'Order activated', 'status': 'active'}), 200

        return jsonify({'message': 'No action taken'}), 200


@orders_bp.route('/feeder-orders', methods=['GET'])
@handle_db_errors
def list_feeder_orders():
    job_type_id = request.args.get('job_type', type=int)
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        if job_type_id:
            cursor.execute('''
                SELECT fo.id, fo.order_name, fr.name as recipe_name, fr.job_type_id, fo.status, fo.created_at
                FROM feeder_orders fo
                JOIN feeder_recipes fr ON fo.recipe_id = fr.id
                WHERE fr.job_type_id = %s
            ''', (job_type_id,))
        else:
            cursor.execute('''
                SELECT fo.id, fo.order_name, fr.name as recipe_name, fr.job_type_id, fo.status, fo.created_at
                FROM feeder_orders fo
                JOIN feeder_recipes fr ON fo.recipe_id = fr.id
            ''')

        orders = cursor.fetchall()
        for order in orders:
            if order.get('created_at'):
                order['created_at'] = order['created_at'].isoformat()

        return jsonify(orders)



@orders_bp.route('/feeder-orders/update/<int:order_id>', methods=['POST'])
@handle_db_errors
def update_feeder_order(order_id):
    data = request.get_json()
    kpis = data.get('kpis', [])
    feeders = data.get('feeders', [])
    stop_options = data.get('stopOptions', {})

    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE feeder_orders
            SET kpis = %s::jsonb,
                feeders = %s::jsonb,
                stop_options = %s::jsonb
            WHERE id = %s
        ''', (
            json.dumps(kpis),
            json.dumps(feeders),
            json.dumps(stop_options),
            order_id
        ))
        conn.commit()

    return jsonify({'status': 'updated'}), 200


@orders_bp.route('/feeder-orders/duplicate/<int:order_id>', methods=['POST'])
@handle_db_errors
def duplicate_feeder_order(order_id):
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("SELECT * FROM feeder_orders WHERE id = %s", (order_id,))
        order = cursor.fetchone()
        if not order:
            return jsonify({'error': 'Order not found'}), 404

        cursor.execute('''
            INSERT INTO feeder_orders (job_type_id, recipe_id, order_name, kpis, feeders, stop_options, status)
            VALUES (%s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb, 'idle')
            RETURNING id
        ''', (
            order['job_type_id'],
            order['recipe_id'],
            order['order_name'] + ' Copy',
            json.dumps(order['kpis']),
            json.dumps(order['feeders']),
            json.dumps(order['stop_options'])
        ))
        new_order_id = cursor.fetchone()['id']
        conn.commit()

    return jsonify({'message': 'Feeder order duplicated', 'new_order_id': new_order_id}), 200


@orders_bp.route('/feeder-orders/delete/<int:order_id>', methods=['DELETE'])
@handle_db_errors
def delete_feeder_order(order_id):
    with closing(get_db_connection()) as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM feeder_orders WHERE id = %s", (order_id,))
        conn.commit()

    return jsonify({'message': 'Feeder order deleted'}), 200

@orders_bp.route('/get-feeder-active-order', methods=['GET'])
@handle_db_errors
def get_feeder_active_order():
    job_type_id = request.args.get('job_type_id', type=int)
    if job_type_id is None:
        return jsonify({'error': 'job_type_id parameter is required'}), 400

    with closing(get_db_connection()) as conn:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # 1. Fetch active feeder order
        cursor.execute("""
            SELECT f.*, r.name AS recipe_name, r.job_type_id, jt.name AS job_type_name
            FROM feeder_orders f
            JOIN feeder_recipes r ON f.recipe_id = r.id
            JOIN job_types jt ON r.job_type_id = jt.id
            WHERE f.status = 'active' AND r.job_type_id = %s
        """, (job_type_id,))
        feeder_order = cursor.fetchone()

        if not feeder_order:
            return jsonify({'error': 'No active feeder order found for this job type'}), 404

        # 2. Parse JSON fields (kpis, feeders, stop_options)
        for key in ['kpis', 'feeders', 'stop_options']:
            if isinstance(feeder_order.get(key), str):
                try:
                    feeder_order[key] = json.loads(feeder_order[key])
                except Exception:
                    feeder_order[key] = [] if key in ['kpis', 'feeders'] else {}

        # 3. Load bin and material maps
        cursor.execute("SELECT id, bin_name FROM bins")
        bin_map = {row['id']: row['bin_name'] for row in cursor.fetchall()}

        cursor.execute("SELECT id, material_name FROM materials")
        material_map = {row['id']: row['material_name'] for row in cursor.fetchall()}

        # 4. Enrich feeders
        feeders = feeder_order.get('feeders', [])
        enriched_feed = []
        for idx, f in enumerate(feeders):
            enriched_feed.append({
                'feeder_number': idx + 1,
                'bin_id': f.get('bin_id'),
                'bin_name': bin_map.get(f.get('bin_id'), 'Unknown'),
                'material_name': (
                    f.get('material_name') or
                    material_map.get(f.get('material_id')) or
                    'Unnamed'
                ),
                'percentage': f.get('percentage', 0)
            })

        # 5. Format KPIs into dictionary
        kpis = {}
        for item in feeder_order.get('kpis', []):
            name = item.get('kpi_name', '').strip()
            if name:
                kpis[name] = item

        # 6. Build final response
        response = {
            'id': feeder_order.get('id'),
            'recipe_name': feeder_order.get('recipe_name'),
            'kpis': kpis,
            'feeders': enriched_feed,
            'stop_options': feeder_order.get('stop_options', {}),
            'created_at': feeder_order['created_at'].isoformat() if feeder_order.get('created_at') else None,
            'job_type': feeder_order.get('job_type_name'),
            'job_type_id': feeder_order.get('job_type_id'),
            'status': feeder_order.get('status')
        }

        return jsonify(response), 200

@orders_bp.route('/reporting/db2099', methods=['GET'])
def get_db2099_report():
    import struct
    from flask import jsonify
    from psycopg2.extras import RealDictCursor

    DB_NUMBER = 2099
    DB_SIZE = 96

    try:
        # Step 1: Load bins from database
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("SELECT id, bin_name, bin_code FROM bins")
                all_bins = cursor.fetchall()

        # Step 2: Prepare bin_code → bin_info mapping
        bin_lookup = {}
        for b in all_bins:
            code = (b['bin_code'] or '').strip().lstrip('0')  # normalize like '021A'
            if code:
                bin_lookup[code] = {
                    'bin_id': b['id'],
                    'bin_name': b['bin_name']
                }

        # Step 3: Connect to PLC and read DB block
        plc = connect_to_plc_fast()  # ✅ Persistent connection
        raw_block = plc.db_read(DB_NUMBER, 0, DB_SIZE)

        def read_real(offset):
            raw = raw_block[offset:offset+4][::-1]
            return round(struct.unpack('<f', raw)[0], 6)

        result = {}

        def add(tag, offset, unit='', conv=None):
            val = read_real(offset)
            if conv:
                val = round(conv(val), 6)

            bin_code = None
            if '_' in tag:
                bin_code = tag.split('_')[0].replace('-', '').lstrip('0')  # e.g., '021A'

            bin_info = bin_lookup.get(bin_code) if bin_code else None

            result[tag] = {
                'value': val,
                'unit': unit,
                'bin_code': bin_code,
                'bin_id': bin_info['bin_id'] if bin_info else None,
                'bin_name': bin_info['bin_name'] if bin_info else None
            }

        # ---- FlowRate Ton/hr (NO CONVERSION - Direct PLC values) ----
        add('FlowRate_2_521WE', 0, 't/h')
        add('FlowRate_3_523WE', 4, 't/h')
        add('FlowRate_3_522WE', 8, 't/h')
        add('FlowRate_3_520WE', 12, 't/h')
        add('FlowRate_3_524WE', 16, 't/h')

        # ---- Percentages ----
        add('Bran_Coarse', 20)
        add('Flour_1', 24)
        add('B1', 28)
        add('Bran_Fine', 32)
        add('Semolina', 36)

        # ---- Flow Balancers (NO CONVERSION - Direct PLC values) ----
        add('031_2_710WE', 40, 't/h')
        add('032_2_711WE', 44, 't/h')
        add('FCL1_2_520WE', 48, 't/h')
        add('021A_2_522WE', 52, 't/h')
        add('021B_2_523WE', 56, 't/h')
        add('021C_2_524WE', 60, 't/h')
        add('021_2_782WE', 64, 't/h')
        add('022_2_783WE', 68, 't/h')
        add('023_2_784WE', 72, 't/h')
        add('025_2_785WE', 76, 't/h')

        # ---- Water Flow (NO CONVERSION - Direct PLC value) ----
        add('2-500LC_Water_Flow', 80, 'L/h')

        # ---- Final Flow Balancers (NO CONVERSION - Direct PLC values) ----
        add('027_2_786WE', 84, 't/h')
        add('028_2_787WE', 88, 't/h')
        add('029_2_708WE', 92, 't/h')

        # plc.disconnect()  # ✅ No disconnect - keeping persistent connection

        return jsonify({'status': 'success', 'data': result}), 200

    except Exception as e:
        logger.error(f"Error in get_db2099_report: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': str(e)}), 500

#----------------------------------------------FCL----------------------------------------------------

#
@orders_bp.route('/plc/active-bin-order-data', methods=['GET'])
def get_active_bin_order_data():
    import struct
    import logging
    import snap7

    logger = logging.getLogger(__name__)
    job_type_id = request.args.get('job_type_id', type=int)

    if not job_type_id:
        return jsonify({'error': 'Missing job_type_id'}), 400

    try:
        db_number = get_db_number_for_job_type(job_type_id)
        if not db_number:
            return jsonify({'error': 'No DB number mapped for this job_type_id'}), 500

        plc = connect_to_plc_fast()  # ✅ Use persistent connection

        # --- Read Run Status (DBX526.0) ---
        run_data = plc.db_read(db_number, 526, 1)
        line_running = bool(run_data[0] & 0x01)
        logger.info(f"Line running: {line_running}")

        # --- Read Active Destination ---
        dest_data = plc.db_read(db_number, 528, 8)
        active_dest = {
            "dest_no": struct.unpack('>h', dest_data[0:2])[0],
            "bin_id": struct.unpack('>h', dest_data[2:4])[0],
            "prd_code": struct.unpack('>i', dest_data[4:8])[0]
        }
        logger.info(f"Active Destination: {active_dest}")

        # --- Read All Sources (bin_id != 0) ---
        plc_sources = []
        active_bin_ids = []
        for i in range(5):
            offset = 536 + i * 16
            raw = plc.db_read(db_number, offset, 16)
            bin_id = struct.unpack('>h', raw[2:4])[0]

            if bin_id != 0:
                source = {
                    "source_index": i + 1,
                    "is_active": bool(raw[0] & 0x01),
                    "bin_id": bin_id,
                    "qty_percent": round(struct.unpack('>f', raw[4:8])[0], 3),
                    "produced_qty": round(struct.unpack('>f', raw[8:12])[0], 3),
                    "prd_code": struct.unpack('>i', raw[12:16])[0]
                }
                plc_sources.append(source)
                active_bin_ids.append(bin_id)

        logger.info(f"PLC Source BIN IDs: {active_bin_ids}")

        # --- Read OS Comment ---
        os_data = plc.db_read(db_number, 616, 66)
        os_comment = os_data[2:2 + os_data[1]].decode('ascii', errors='ignore')
        logger.info(f"OS Comment: {os_comment}")

        # plc.disconnect()  # ✅ No disconnect - keeping persistent connection

        # --- Fetch Active Order ---
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                cursor.execute("""
                    SELECT o.kpis, o.order_sources, o.order_destinations
                    FROM orders o
                    WHERE o.job_type_id = %s AND o.status = 'active'
                    ORDER BY o.created_at DESC
                    LIMIT 1
                """, (job_type_id,))
                order = cursor.fetchone()

                if not order:
                    return jsonify({'error': 'No active order found'}), 404

                order_sources = order['order_sources']
                order_destinations = order['order_destinations']
                kpis = order['kpis']

                logger.info(f"DB Order Source BINs: {[s['bin_id'] for s in order_sources]}")

                # Match all PLC sources to DB order_sources by bin_id
                matched_sources = []
                for src in plc_sources:
                    match = next((s for s in order_sources if s['bin_id'] == src['bin_id']), None)
                    if match:
                        matched = match.copy()
                        matched['source_index'] = src['source_index']
                        matched['qty_percent'] = src['qty_percent']
                        matched['produced_qty'] = src['produced_qty']
                        matched['is_active'] = src['is_active']
                        matched['prd_code'] = src['prd_code']
                        matched_sources.append(matched)

                # Match destination by bin_id
                matched_dest = next(
                    (d for d in order_destinations if d['bin_id'] == active_dest['bin_id']),
                    active_dest
                )

                # Compose KPI definitions
                kpi_defs = []
                for idx, kpi in enumerate(kpis):
                    kpi_defs.append({
                        "kpi_name": kpi["kpi_name"],
                        "data_type": kpi["data_type"],
                        "default_value": kpi["value"],
                        "unit": kpi["unit"],
                        "read_write": "R" if kpi["kpi_name"] in ["Dynamic", "Parameters", "Tempering"] else "W",
                        "bit_value": 0,
                        "db_offset": 694 + idx * 4
                    })

        return jsonify({
            "job_type_id": job_type_id,
            "active_destination": matched_dest,
            "active_sources": matched_sources,
            "kpi_definitions": kpi_defs,
            "line_running": line_running,
            "os_comment": os_comment
        }), 200

    except Exception as e:
        logger.exception("Error in /plc/active-bin-order-data")
        return jsonify({"error": str(e)}), 500

# Feeder flow map for FCL: bin_code → (offset in DB2099)
# Must be defined BEFORE db199-monitor function that uses it
# IMPORTANT: PLC uses bin CODES (21, 22, 23) not database IDs (7, 8, 9)!
FCL_FEEDER_FLOW_MAP = {
    # Main bins (from PLC bin codes)
    21: 64,   # Bin 21  → offset 64 (021_2_782WE)
    22: 68,   # Bin 22  → offset 68 (022_2_783WE)
    23: 72,   # Bin 23  → offset 72 (023_2_784WE)
    24: 778,  # Bin 24  → offset from original map
    25: 76,   # Bin 25  → offset 76 (025_2_785WE)
    26: 1030, # Bin 26  → offset from original map
    27: 84,   # Bin 27  → offset 84 (027_2_786WE)
    28: 88,   # Bin 28  → offset 88 (028_2_787WE)
    29: 92,   # Bin 29  → offset 92 (029_2_708WE)
    30: 1534, # Bin 30  → offset from original map
    31: 40,   # Bin 31  → offset 40 (031_2_710WE)
    32: 44,   # Bin 32  → offset 44 (032_2_711WE)
    # Lettered bins (string keys for database lookup)
    '21A': 52,  # Bin 21A → offset 52 (021A_2_522WE)
    '21B': 56,  # Bin 21B → offset 56 (021B_2_523WE)
    '21C': 60,  # Bin 21C → offset 60 (021C_2_524WE)
    # PLC encoded bins (211->21A, 212->21B, 213->21C)
    211: 52,   # PLC 211 → Bin 21A → offset 52 (021A_2_522WE)
    212: 56,   # PLC 212 → Bin 21B → offset 56 (021B_2_523WE)
    213: 60,   # PLC 213 → Bin 21C → offset 60 (021C_2_524WE)
    '21B': 56,  # Bin 21B → offset 56 (021B_2_523WE)
    '21C': 60,  # Bin 21C → offset 60 (021C_2_524WE)
}

@orders_bp.route('/plc/db199-monitor', methods=['GET'])
def read_db199_monitor():
    import struct
    from flask import jsonify
    from snap7.util import get_bool
    # from . import connect_to_plc

    DB_NUMBER = 199
    DB2099 = 2099

    def read_real(plc, offset):
        raw = plc.db_read(DB_NUMBER, offset, 4)
        return round(struct.unpack('>f', raw)[0], 3)

    def read_int(plc, offset):
        raw = plc.db_read(DB_NUMBER, offset, 2)
        return struct.unpack('>h', raw)[0]

    def read_string(plc, offset, max_len=64):
        raw = plc.db_read(DB_NUMBER, offset, max_len + 2)
        length = raw[1]
        return raw[2:2 + length].decode('ascii', errors='ignore')

    def read_real_db2099(plc, offset):
        """Read Real (4 bytes, big-endian) from DB2099. e.g. 2-500LC_Water_Flow at offset 80 (l/h)."""
        raw = plc.db_read(DB2099, offset, 4)
        return round(struct.unpack('>f', raw)[0], 3)

    def read_flow_rate(plc, db_num, offset):
        """Read flow rate (REAL) from DB2099"""
        try:
            raw = plc.db_read(db_num, offset, 4)
            # Reverse bytes for little-endian
            raw_reversed = raw[::-1]
            value = struct.unpack('<f', raw_reversed)[0]
            
            # Enhanced logging
            if value == 0.0:
                logger.warning(f"[FCL] ⚠️ Read 0.0 from DB{db_num} offset {offset}: raw={raw.hex()}, reversed={raw_reversed.hex()}")
                if raw.hex() == '00000000':
                    logger.warning(f"[FCL] ⚠️ Offset {offset} contains all zeros - PLC might not be writing to this address!")
            else:
                logger.debug(f"[FCL] Read flow from DB{db_num} offset {offset}: raw={raw.hex()}, value={value}")
            
            return round(value, 6)
        except Exception as e:
            logger.error(f"[FCL] Failed to read flow at DB{db_num} offset {offset}: {e}", exc_info=True)
            return 0.0
    
    def read_dint_counter(plc, db_num, offset):
        """Read DInt cumulative counter from DB2099"""
        try:
            raw = plc.db_read(db_num, offset, 4)
            # Reverse bytes for little-endian
            raw_reversed = raw[::-1]
            value = struct.unpack('<i', raw_reversed)[0]
            
            logger.debug(f"[FCL] Read DInt counter from DB{db_num} offset {offset}: raw={raw.hex()}, value={value} kg")
            return value
        except Exception as e:
            logger.error(f"[FCL] Failed to read DInt at DB{db_num} offset {offset}: {e}", exc_info=True)
            return 0

    def read_active_destination(plc):
        data = plc.db_read(DB_NUMBER, 528, 8)
        return {
            'dest_no': struct.unpack('>h', data[0:2])[0],
            'bin_id': struct.unpack('>h', data[2:4])[0],
            'prd_code': struct.unpack('>i', data[4:8])[0]
        }

    def convert_plc_bin_to_db_code(plc_bin_id):
        """
        Convert PLC bin ID to database bin_code format
        211 -> 21A
        212 -> 21B
        213 -> 21C
        21 -> 21 (unchanged)
        """
        if plc_bin_id >= 210 and plc_bin_id <= 219:
            # Extract base number and suffix
            base = plc_bin_id // 10  # 211 // 10 = 21
            suffix_num = plc_bin_id % 10  # 211 % 10 = 1
            
            if suffix_num >= 1 and suffix_num <= 3:
                # Convert 1->A, 2->B, 3->C
                suffix_letter = chr(ord('A') + suffix_num - 1)
                db_code = f"{base}{suffix_letter}"
                logger.debug(f"[FCL] Converted PLC bin {plc_bin_id} -> DB bin_code '{db_code}'")
                return db_code
        
        # No conversion needed
        return plc_bin_id

    def read_active_sources(plc):
        sources = []
        active_bin_ids = []
        for i in range(5):
            offset = 536 + i * 16
            data = plc.db_read(DB_NUMBER, offset, 16)
            bin_id = struct.unpack('>h', data[2:4])[0]
            
            logger.info(f"[FCL] Reading source slot {i+1}: bin_id={bin_id}")
            
            if bin_id == 0:
                logger.debug(f"[FCL] Slot {i+1}: bin_id is 0, skipping")
                continue
            
            active_bin_ids.append(bin_id)
            source = {
                'source_index': i + 1,
                'is_active': bool(data[0] & 0x01),
                'bin_id': bin_id,
                'qty_percent': round(struct.unpack('>f', data[4:8])[0], 3),
                'produced_qty': round(struct.unpack('>f', data[8:12])[0], 3),
                'prd_code': struct.unpack('>i', data[12:16])[0]
            }
            
            # ✅ Convert PLC bin ID for flow map lookup (211->21A, 212->21B, 213->21C)
            db_bin_code = convert_plc_bin_to_db_code(bin_id)
            
            # Add flow rate from DB2099 if mapping exists (check both PLC ID and converted code)
            if bin_id in FCL_FEEDER_FLOW_MAP:
                flow_offset = FCL_FEEDER_FLOW_MAP[bin_id]
                logger.debug(f"[FCL] Bin {bin_id} found in map, reading from offset {flow_offset}")
                source['weight'] = read_flow_rate(plc, DB2099, flow_offset)
            elif db_bin_code in FCL_FEEDER_FLOW_MAP:
                flow_offset = FCL_FEEDER_FLOW_MAP[db_bin_code]
                logger.debug(f"[FCL] Converted bin {db_bin_code} (PLC: {bin_id}) found in map, reading from offset {flow_offset}")
                source['weight'] = read_flow_rate(plc, DB2099, flow_offset)
            else:
                logger.warning(f"[FCL] Bin {bin_id} (converted: {db_bin_code}) NOT in FCL_FEEDER_FLOW_MAP, setting weight to 0")
                source['weight'] = 0.0
            
            sources.append(source)
            
        logger.info(f"[FCL] Total bins read from PLC: {len(sources)}, bin_ids: {active_bin_ids}")
        return sources, active_bin_ids

    def read_line_running(plc):
        data = plc.db_read(DB_NUMBER, 526, 1)  # DBX526.0
        return get_bool(data, 0, 0)

    def read_job_status_from_db2099(plc, db2099, offset):
        """Read job status from DB2099 as Bool and convert to Int"""
        try:
            data = plc.db_read(db2099, offset, 1)
            job_status_bool = get_bool(data, 0, 0)
            # Convert Bool to Int: True=1 (active), False=0 (done)
            job_status_int = 1 if job_status_bool else 0
            logger.info(f"[FCL] Job Status from DB2099 offset {offset}: {job_status_bool} (Bool) → {job_status_int} (Int) - {'order_active' if job_status_bool else 'order_done'}")
            return job_status_int
        except Exception as e:
            logger.error(f"[FCL] Failed to read job_status from DB2099 offset {offset}: {e}", exc_info=True)
            return 0

    try:
        plc = connect_to_plc_fast()  # ✅ Persistent connection

        active_sources, active_bin_ids = read_active_sources(plc)
        active_destination = read_active_destination(plc)
        dest_bin_id = active_destination.get('bin_id')
        if dest_bin_id and dest_bin_id > 0:
            active_bin_ids.append(dest_bin_id)

        # ✅ Read "Cleaning Scale bypass" (offset 710, Bool)
        cleaning_scale_bypass_data = plc.db_read(DB_NUMBER, 710, 1)
        cleaning_scale_bypass = get_bool(cleaning_scale_bypass_data, 0, 0) # Assumes first bit, user said "710 | Check Box"

        # ✅ Read FCL receivers from DB2099 (multiple receivers)
        # Read receiver 1 - Use ACTUAL destination bin ID from PLC (not hardcoded 081)
        receiver_1_weight = read_flow_rate(plc, DB2099, 48)
        logger.debug(f"[FCL] Receiver 1 (bin {dest_bin_id}) weight: {receiver_1_weight} t/h")
        
        # Read receiver 2 (FCL 2_520WE) - Cumulative counter from offset 108 (DInt)
        # Offset 108 contains "2_520WE_Non_Erasable_Weight" - cumulative weight in kg
        receiver_2_counter = read_dint_counter(plc, DB2099, 108)
        logger.debug(f"[FCL] Receiver 2 (FCL_2_520WE) cumulative weight: {receiver_2_counter} kg (from offset 108)")
        
        # Convert cumulative counter to display value (kg)
        # Display as large cumulative value, not flow rate
        receiver_2_weight = float(receiver_2_counter)  # Keep full cumulative value in kg
        logger.debug(f"[FCL] Receiver 2 (FCL_2_520WE) display weight: {receiver_2_weight} kg")
        
        # ✅ Use actual destination bin ID from PLC (will be enriched with material name later)
        fcl_receivers = [
            {
                'id': str(dest_bin_id).zfill(4) if dest_bin_id else '0000',  # ✅ Dynamic from PLC
                'name': 'Output Bin',  # ✅ Will be enriched with material name from database
                'location': 'Output Bin',
                'weight': receiver_1_weight,
                'bin_id': dest_bin_id  # ✅ Store raw bin ID for enrichment
            },
            {
                'id': 'FCL_2_520WE',
                'name': 'FCL 2_520WE',
                'location': 'FCL 2_520WE',
                'weight': receiver_2_weight
            }
        ]
        
        logger.info(f"[FCL] Total receivers: bin_{dest_bin_id}={receiver_1_weight} t/h, FCL_2_520WE={receiver_2_weight} t/h, SUM={receiver_1_weight + receiver_2_weight} t/h")
        
        result = {
            'line_running': read_line_running(plc),
            'produced_weight': read_real(plc, 564),
            'water_consumed': read_real(plc, 568),
            'flow_rate': read_real(plc, 694),
            'moisture_setpoint': read_real(plc, 702),
            'moisture_offset': read_real(plc, 706),
            'cleaning_scale_bypass': cleaning_scale_bypass, # ✅ New field
            'water_flow_lh': read_real_db2099(plc, 80),  # 2-500LC_Water_Flow, l/h, DB2099 offset 80
            'receiver': fcl_receivers[0]['weight'],  # Keep single value for backwards compatibility
            'fcl_receivers': fcl_receivers,  # New array with all receivers
            # ✅ Read Job Status from DB2099, offset 100 (Bool: 1=order_active, 0=order_done)
            'job_status': read_job_status_from_db2099(plc, DB2099, 100),
            'os_comment': read_string(plc, 616, 64),
            'active_destination': active_destination,
            'active_sources': active_sources
        }

        # plc.disconnect()  # ✅ No disconnect - keeping persistent connection
        
        # ✅ Enrich with material information from database
        with closing(get_db_connection()) as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            # ✅ Query bins with bin_code to match PLC bin IDs
            cursor.execute("SELECT id, bin_name, bin_code, material_id FROM bins")
            all_bins = cursor.fetchall()
            
            # ✅ Create dual lookup: both int and string keys (PLC sends int, DB has string)
            bin_lookup = {}
            for b in all_bins:
                if b["bin_code"]:
                    # Store with string key
                    bin_lookup[b["bin_code"]] = b
                    # Also store with integer key if it's numeric
                    try:
                        int_key = int(b["bin_code"])
                        bin_lookup[int_key] = b
                    except (ValueError, TypeError):
                        # bin_code like "21A" can't be converted to int, that's fine
                        pass

            # Get material IDs for active bins (convert to int for comparison)
            active_bin_ids_int = []
            for bid in active_bin_ids:
                try:
                    active_bin_ids_int.append(int(bid))
                except:
                    active_bin_ids_int.append(bid)
            
            material_ids = []
            for b in all_bins:
                if b["bin_code"] and b["material_id"]:
                    try:
                        if int(b["bin_code"]) in active_bin_ids_int or b["bin_code"] in active_bin_ids:
                            material_ids.append(b["material_id"])
                    except:
                        if b["bin_code"] in active_bin_ids:
                            material_ids.append(b["material_id"])
            
            material_map = {}
            if material_ids:
                cursor.execute("""
                    SELECT id, material_name, material_code
                    FROM materials
                    WHERE id IN %s
                """, (tuple(set(material_ids)),))
                for row in cursor.fetchall():
                    material_map[row["id"]] = row

        # ✅ Enrich active_sources with material info and filter out invalid bins
        original_count = len(result['active_sources'])
        logger.info(f"[FCL] Starting enrichment for {original_count} sources from PLC")
        
        valid_sources = []
        for idx, source in enumerate(result['active_sources']):
            plc_bin_id = source['bin_id']  # PLC sends this as integer (21, 211, 212, etc.)
            logger.info(f"[FCL] Processing source {idx+1}: PLC bin_id={plc_bin_id}, weight={source.get('weight', 'N/A')}")
            
            # ✅ Convert PLC bin ID to database bin_code (211->21A, 212->21B, 213->21C)
            db_bin_code = convert_plc_bin_to_db_code(plc_bin_id)
            logger.info(f"[FCL] Converted bin {plc_bin_id} -> {db_bin_code} for database lookup")
            
            # Try to find bin info using converted code
            bin_info = bin_lookup.get(db_bin_code) or bin_lookup.get(str(db_bin_code))
            
            if not bin_info:
                logger.warning(f"[FCL] ⚠️ Bin {db_bin_code} (PLC: {plc_bin_id}) not found in database - SHOWING WITH WARNING")
                logger.warning(f"[FCL] Available bins in lookup: {list(bin_lookup.keys())[:20]}")  # Show first 20 keys
                # Show bin with warning message instead of filtering out
                source['prd_name'] = f"⚠️ Invalid Bin ({plc_bin_id})"
                source['prd_code'] = 0
                valid_sources.append(source)
                continue
            
            mat_id = bin_info.get("material_id")
            logger.debug(f"[FCL] Bin {db_bin_code} (PLC: {plc_bin_id}) found in DB: bin_name={bin_info['bin_name']}, material_id={mat_id}")
            
            if mat_id and mat_id in material_map:
                source['material'] = {
                    "id": mat_id,
                    "material_name": material_map[mat_id]["material_name"],
                    "material_code": material_map[mat_id]["material_code"]
                }
                # Update prd_code with actual material code
                source['prd_code'] = int(material_map[mat_id]["material_code"])
                # Add prd_name for frontend compatibility
                source['prd_name'] = material_map[mat_id]["material_name"]
                logger.info(f"[FCL] ✅ Enriched PLC bin {plc_bin_id} (DB: {db_bin_code}): {source['prd_name']} (Material Code: {source['prd_code']}, Weight: {source.get('weight', 'N/A')})")
            else:
                logger.warning(f"[FCL] ⚠️ No material assigned to bin {db_bin_code} (PLC: {plc_bin_id})")
                source['prd_name'] = f"{bin_info['bin_name']} (No Material)"
            
            # Add to valid sources list
            valid_sources.append(source)
        
        # Replace active_sources with filtered list
        result['active_sources'] = valid_sources
        logger.info(f"[FCL] ✅ Final result: {len(valid_sources)} valid bins out of {original_count} sources from PLC")

        # ✅ Enrich active_destination with material info
        if dest_bin_id:
            # ✅ Convert PLC bin ID to database bin_code
            dest_db_bin_code = convert_plc_bin_to_db_code(dest_bin_id)
            logger.info(f"[FCL] Converted destination bin {dest_bin_id} -> {dest_db_bin_code} for database lookup")
            logger.info(f"[FCL] Available bin_codes in database: {list(bin_lookup.keys())[:20]}")  # Show first 20
            
            bin_info = bin_lookup.get(dest_db_bin_code) or bin_lookup.get(str(dest_db_bin_code))
            logger.info(f"[FCL] Bin lookup result for {dest_db_bin_code}: {bin_info}")
            if bin_info:
                mat_id = bin_info.get("material_id")
                if mat_id and mat_id in material_map:
                    result['active_destination']['material'] = {
                        "id": mat_id,
                        "material_name": material_map[mat_id]["material_name"],
                        "material_code": material_map[mat_id]["material_code"]
                    }
                    result['active_destination']['prd_code'] = int(material_map[mat_id]["material_code"])
                    logger.info(f"[FCL] ✅ Enriched destination PLC bin {dest_bin_id} (DB: {dest_db_bin_code}): {material_map[mat_id]['material_name']}")
                    
                    # ✅ Also enrich fcl_receivers[0] with the same material info
                    if result.get('fcl_receivers') and len(result['fcl_receivers']) > 0:
                        result['fcl_receivers'][0]['id'] = str(dest_bin_id).zfill(4)
                        result['fcl_receivers'][0]['name'] = material_map[mat_id]["material_name"]
                        result['fcl_receivers'][0]['location'] = f"Bin {dest_db_bin_code}"
                        result['fcl_receivers'][0]['material_code'] = material_map[mat_id]["material_code"]
                        logger.info(f"[FCL] ✅ Enriched receiver 1 with material: {material_map[mat_id]['material_name']} (Bin {dest_bin_id})")
                else:
                    logger.warning(f"[FCL] ⚠️ No material found for destination bin {dest_db_bin_code} (PLC: {dest_bin_id})")
            else:
                logger.warning(f"[FCL] ⚠️ Destination bin {dest_db_bin_code} (PLC: {dest_bin_id}) not found in database")

        return jsonify({'status': 'success', 'data': result, 'fcl_receivers': result.get('fcl_receivers', [])}), 200

    except Exception as e:
        logger.exception("Error in /plc/db199-monitor")
        return jsonify({'status': 'error', 'message': str(e)}), 500

#-----------------------------------------DB299-------------------------------------------------------------
DB299 = 299
DB2099 = 2099

# Static fields from DB299
# Note: JobStatusCode is now read from DB2099 offset 102 (Bool) - see db299_monitor() function
DB299_FIELDS = [
    ("LineRunning", "Bool", 526),  # Same offset as FCL DB199
    ("DestNo", "Int", 528),
    ("DestBinId", "Int", 530),
    ("PrdCode", "DInt", 532),
    ("OS_Comment", "String[64]", 616),
    ("JobStatusCode", "Int", 682),  # ⚠️ NOT USED - Read from DB2099 offset 102 instead
    ("Flowrate", "Real", 694),
    ("JobQty", "Real", 698),
    ("MoistureSetpoint", "Real", 702),
    ("MoistureOffset", "Real", 706),
    ("Dumping", "Bool", 710),
]

# Feeder flow map for SCL: bin_id → (offset in DB2099)
FEEDER_FLOW_MAP = {
    "027_2_786WE": (27, 84),
    "028_2_787WE": (28, 88),
    "029_2_708WE": (29, 92),
    "032_2_711WE": (32, 44)  # ✅ New: DestBinId bin 32 with offset 44
}

def parse_field(client, db_number, dtype, offset):
    try:
        if dtype == "Bool":
            byte_offset = int(offset)
            bit_offset = int(round((offset - byte_offset) * 10))
            data = client.db_read(db_number, byte_offset, 1)
            return get_bool(data, 0, bit_offset)
        elif dtype == "Int":
            data = client.db_read(db_number, int(offset), 2)
            return struct.unpack('>h', data)[0]
        elif dtype == "DInt":
            data = client.db_read(db_number, int(offset), 4)
            return struct.unpack('>i', data)[0]
        elif dtype == "Real":
            data = client.db_read(db_number, int(offset), 4)
            return round(struct.unpack('>f', data)[0], 3)
        elif dtype.startswith("String"):
            max_len = int(dtype[dtype.find('[')+1:dtype.find(']')])
            raw = client.db_read(db_number, int(offset), max_len + 2)
            length = raw[1]
            return raw[2:2 + length].decode('ascii', errors='ignore')
        else:
            return f"❌ Unsupported type: {dtype}"
    except Exception as e:
        return f"❌ Error: {e}"

def read_flow(client, db_number, offset):
    """Read raw flow value from PLC (t/h) - NO CONVERSION for live monitor"""
    try:
        data = client.db_read(db_number, offset, 4)
        raw = struct.unpack('>f', data)[0]
        return round(raw, 3)  # ✅ Return raw t/h value without conversion
    except Exception as e:
        return 0  # fallback to 0 on error

@orders_bp.route('/plc/db299-monitor', methods=['GET'])
def db299_monitor():
    try:
        client = connect_to_plc()
        result = {}

        # Read static fields from DB299 (except JobStatusCode)
        for name, dtype, offset in DB299_FIELDS:
            if name != "JobStatusCode":  # Skip JobStatusCode from DB299
                result[name] = parse_field(client, DB299, dtype, offset)
        
        # Read Job Status from DB2099, offset 102 (Bool: 1=order_active, 0=order_done)
        job_status_bool = parse_field(client, DB2099, "Bool", 102)
        # Convert Bool to Int for compatibility: True=1 (active), False=0 (done)
        result["JobStatusCode"] = 1 if job_status_bool else 0
        logger.info(f"[SCL] Job Status from DB2099 offset 102: {job_status_bool} (Bool) → {result['JobStatusCode']} (Int) - {'order_active' if job_status_bool else 'order_done'}")

        # Read Active Sources
        result["ActiveSources"] = []
        active_bin_ids = []

        for i in range(1, 6):
            offset = 536 + (i - 1) * 16
            data = client.db_read(DB299, offset, 16)
            bin_id = struct.unpack('>h', data[2:4])[0]
            if bin_id == 0:
                continue

            active_bin_ids.append(bin_id)

            source = {
                "source_index": i,
                "is_active": bool(data[0] & 0x01),
                "bin_id": bin_id,
                "qty_percent": round(struct.unpack('>f', data[4:8])[0], 3),
                "produced_qty": round(struct.unpack('>f', data[8:12])[0], 3),
                "prd_code": struct.unpack('>i', data[12:16])[0]
            }

            # Get flowrate (raw t/h from PLC)
            for tag, (flow_bin_id, offset) in FEEDER_FLOW_MAP.items():
                if flow_bin_id == bin_id:
                    source["flowrate_tph"] = read_flow(client, DB2099, offset)  # ✅ Changed from flowrate_kgps to flowrate_tph
                    break

            result["ActiveSources"].append(source)

        # Read all feeder flows (raw t/h values)
        result["FeederFlows"] = {
            tag: {
                "bin_id": bin_id,
                "unit": "t/h",  # ✅ Changed from kg/s to t/h (raw PLC value)
                "value": read_flow(client, DB2099, offset)
            } for tag, (bin_id, offset) in FEEDER_FLOW_MAP.items()
        }

        # Collect DestBinId
        dest_bin_id = result.get("DestBinId")
        if isinstance(dest_bin_id, int) and dest_bin_id > 0:
            active_bin_ids.append(dest_bin_id)

        # Disconnect PLC before DB queries
        client.disconnect()

        # ✅ DB lookup for bin and material enrichment
        with closing(get_db_connection()) as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            # ✅ Query bins with bin_code to match PLC bin IDs
            cursor.execute("SELECT id, bin_name, bin_code, material_id FROM bins")
            all_bins = cursor.fetchall()
            
            # ✅ Create dual lookup: both int and string keys (PLC sends int, DB has string)
            bin_lookup = {}
            for b in all_bins:
                if b["bin_code"]:
                    # Store with string key
                    bin_lookup[b["bin_code"]] = b
                    # Also store with integer key if it's numeric
                    try:
                        int_key = int(b["bin_code"])
                        bin_lookup[int_key] = b
                    except (ValueError, TypeError):
                        pass

            # Get material IDs for active bins (handle type conversion)
            active_bin_ids_int = []
            for bid in active_bin_ids:
                try:
                    active_bin_ids_int.append(int(bid))
                except:
                    active_bin_ids_int.append(bid)
            
            material_ids = []
            for b in all_bins:
                if b["bin_code"] and b["material_id"]:
                    try:
                        if int(b["bin_code"]) in active_bin_ids_int or b["bin_code"] in active_bin_ids:
                            material_ids.append(b["material_id"])
                    except:
                        if b["bin_code"] in active_bin_ids:
                            material_ids.append(b["material_id"])
            
            material_map = {}
            if material_ids:
                cursor.execute("""
                    SELECT id, material_name, material_code
                    FROM materials
                    WHERE id IN %s
                """, (tuple(set(material_ids)),))
                for row in cursor.fetchall():
                    material_map[row["id"]] = row

        # ✅ Enrich ActiveSources and filter out invalid bins
        valid_sources = []
        for source in result["ActiveSources"]:
            bin_code = source["bin_id"]  # PLC sends this as integer
            
            # Try to find bin info (works with both int and string keys)
            bin_info = bin_lookup.get(bin_code) or bin_lookup.get(str(bin_code))
            
            if not bin_info:
                logger.warning(f"[DB299] ⚠️ Bin {bin_code} not found in database - SHOWING WITH WARNING")
                # Show bin with warning message instead of filtering out
                source["prd_name"] = f"⚠️ Invalid Bin ({bin_code})"
                source["prd_code"] = 0
                valid_sources.append(source)
                continue
            
            mat_id = bin_info.get("material_id")
            
            if mat_id and mat_id in material_map:
                source["material"] = {
                    "id": mat_id,
                    "material_name": material_map[mat_id]["material_name"],
                    "material_code": material_map[mat_id]["material_code"]
                }
                logger.debug(f"[DB299] ✅ Enriched bin {bin_code}: {material_map[mat_id]['material_name']}")
            
            # Add to valid sources list
            valid_sources.append(source)
        
        # Replace ActiveSources with filtered list
        result["ActiveSources"] = valid_sources
        logger.debug(f"[DB299] Filtered sources: {len(valid_sources)} valid bins")

        # ✅ Enrich DestBinId
        if isinstance(dest_bin_id, int):
            bin_info = bin_lookup.get(dest_bin_id) or bin_lookup.get(str(dest_bin_id))
            if bin_info:
                mat_id = bin_info.get("material_id")
                if mat_id and mat_id in material_map:
                    result["DestMaterial"] = {
                        "id": mat_id,
                        "material_name": material_map[mat_id]["material_name"],
                        "material_code": material_map[mat_id]["material_code"]
                    }
                    logger.debug(f"[DB299] ✅ Enriched destination bin {dest_bin_id}: {material_map[mat_id]['material_name']}")

        # ========= PRODUCED WEIGHT CALCULATION =========
        # Step 1: bin_id → flowrate map
        flow_bin_weights = {
            v["bin_id"]: v["value"]
            for v in result["FeederFlows"].values()
        }

        # Step 2: total active source flow weights (regardless of is_active)
        total_source_weight = 0
        for source in result["ActiveSources"]:
            bin_id = source.get("bin_id")
            total_source_weight += flow_bin_weights.get(bin_id, 0)

        # Step 3: dest bin weight
        dest_weight = flow_bin_weights.get(dest_bin_id, 0)

        # Step 4: combine for total
        result["ProducedWeight"] = round(total_source_weight + dest_weight, 3)
        result["ProducedWeightBreakdown"] = {
            "source_total": round(total_source_weight, 3),
            "dest_weight": round(dest_weight, 3)
        }

        # Add line_running key for consistency with FCL (SCL monitor expects lowercase)
        result["line_running"] = result.get("LineRunning", False)

        return jsonify({
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "data": result
        })

    except Exception as e:
        logger.exception("Error in /plc/db299-monitor")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

#-----------------------------------------FTRA (DB2099)-------------------------------------------------------------
# FTRA fields from DB2099 starting at offset 136
FTRA_DB = 2099

@orders_bp.route('/plc/ftra-monitor', methods=['GET'])
def ftra_monitor():
    """Read FTRA data from DB2099"""
    try:
        client = connect_to_plc()
        result = {}

        # Read Receiver and Sender Bin IDs
        result["ReceiverBinId"] = parse_field(client, FTRA_DB, "Int", 136)
        result["Sender1BinId"] = parse_field(client, FTRA_DB, "Int", 138)
        result["Sender2BinId"] = parse_field(client, FTRA_DB, "Int", 140)

        # Read Micro Ingredient Setpoints (Feeder 3-6)
        result["Feeder3TargetPercent"] = parse_field(client, FTRA_DB, "Real", 142)
        result["Feeder3Selected"] = parse_field(client, FTRA_DB, "Bool", 146)
        result["Feeder4TargetPercent"] = parse_field(client, FTRA_DB, "Real", 148)
        result["Feeder4Selected"] = parse_field(client, FTRA_DB, "Bool", 152)
        result["Feeder5TargetPercent"] = parse_field(client, FTRA_DB, "Real", 154)
        result["Feeder5Selected"] = parse_field(client, FTRA_DB, "Bool", 158)
        result["Feeder6TargetPercent"] = parse_field(client, FTRA_DB, "Real", 160)
        result["Feeder6Selected"] = parse_field(client, FTRA_DB, "Bool", 164)

        # Read Discharger Speed
        result["SpeedDischarge50Percent"] = parse_field(client, FTRA_DB, "Real", 166)
        result["SpeedDischarge51_55Percent"] = parse_field(client, FTRA_DB, "Real", 170)

        # Read Filter Flour Destination (Bool at byte 174, bit 0 and bit 1)
        byte_174 = client.db_read(FTRA_DB, 174, 1)
        result["BagCollection"] = bool(byte_174[0] & 0x01)  # Bit 0
        result["MixingScrew"] = bool(byte_174[0] & 0x02)    # Bit 1

        # Read Order Active Status (Bool at offset 106, bit 0)
        # 1 = order_active (order started), 0 = order_done (order finished)
        byte_106 = client.db_read(FTRA_DB, 106, 1)
        result["OrderActive"] = bool(byte_106[0] & 0x01)

        # Build ActiveSources list
        result["ActiveSources"] = []
        active_bin_ids = []

        for i, bin_id_field in enumerate(["Sender1BinId", "Sender2BinId"], start=1):
            bin_id = result.get(bin_id_field, 0)
            if bin_id and bin_id > 0:
                active_bin_ids.append(bin_id)
                source = {
                    "source_index": i,
                    "bin_id": bin_id,
                    "weight": 0.0  # Flow rate - will need PLC offset if available
                }
                result["ActiveSources"].append(source)

        # Add receiver to active bins
        receiver_bin_id = result.get("ReceiverBinId", 0)
        if receiver_bin_id and receiver_bin_id > 0:
            active_bin_ids.append(receiver_bin_id)

        # Disconnect PLC before DB queries
        client.disconnect()

        # DB lookup for bin and material enrichment
        with closing(get_db_connection()) as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT id, bin_name, bin_code, material_id FROM bins")
            all_bins = cursor.fetchall()
            
            bin_lookup = {}
            for b in all_bins:
                if b["bin_code"]:
                    bin_lookup[b["bin_code"]] = b
                    try:
                        bin_lookup[int(b["bin_code"])] = b
                    except (ValueError, TypeError):
                        pass

            material_ids = [b["material_id"] for b in all_bins if b["material_id"] and 
                          (b["bin_code"] in [str(x) for x in active_bin_ids] or 
                           (b["bin_code"] and b["bin_code"].isdigit() and int(b["bin_code"]) in active_bin_ids))]
            
            material_map = {}
            if material_ids:
                cursor.execute("""
                    SELECT id, material_name, material_code
                    FROM materials
                    WHERE id IN %s
                """, (tuple(set(material_ids)),))
                for row in cursor.fetchall():
                    material_map[row["id"]] = row

        # Enrich ActiveSources with material info
        for source in result["ActiveSources"]:
            bin_code = source["bin_id"]
            bin_info = bin_lookup.get(bin_code) or bin_lookup.get(str(bin_code))
            
            if bin_info:
                mat_id = bin_info.get("material_id")
                if mat_id and mat_id in material_map:
                    source["material"] = {
                        "id": mat_id,
                        "material_name": material_map[mat_id]["material_name"],
                        "material_code": material_map[mat_id]["material_code"]
                    }
                    source["prd_name"] = material_map[mat_id]["material_name"]
                    source["prd_code"] = int(material_map[mat_id]["material_code"])

        # Enrich Receiver with material info
        result["ReceiverMaterial"] = {}
        if receiver_bin_id:
            bin_info = bin_lookup.get(receiver_bin_id) or bin_lookup.get(str(receiver_bin_id))
            if bin_info:
                mat_id = bin_info.get("material_id")
                if mat_id and mat_id in material_map:
                    result["ReceiverMaterial"] = {
                        "id": mat_id,
                        "material_name": material_map[mat_id]["material_name"],
                        "material_code": material_map[mat_id]["material_code"]
                    }

        logger.info(f"[FTRA] Monitor data: Receiver={receiver_bin_id}, Senders={[s['bin_id'] for s in result['ActiveSources']]}")

        return jsonify({"status": "success", "data": result}), 200

    except Exception as e:
        logger.exception("Error in /plc/ftra-monitor")
        return jsonify({"status": "error", "message": str(e)}), 500

#----------------------------------------MIL-A----------------------------------------
@orders_bp.route('/plc/db499-db2099-monitor', methods=['GET'])
def read_db499_and_db2099_monitor():
    import struct
    from snap7.util import get_bool
    from flask import jsonify
    from psycopg2.extras import RealDictCursor

    PLC_IP = "192.168.23.11"
    DB499 = 499
    DB2099 = 2099
    # ✅ REMOVED FLOW_CONVERSION - Show raw PLC values in t/h for live monitor

    def parse_field(plc, db_number, dtype, offset):
        try:
            if dtype == "Bool":
                byte_offset = int(offset)
                bit_offset = int(round((offset - byte_offset) * 10))
                data = plc.db_read(db_number, byte_offset, 1)
                return get_bool(data, 0, bit_offset)
            elif dtype == "Int":
                data = plc.db_read(db_number, int(offset), 2)
                return struct.unpack('>h', data)[0]
            elif dtype == "DInt":
                data = plc.db_read(db_number, int(offset), 4)
                return struct.unpack('>i', data)[0]
            elif dtype == "Real":
                data = plc.db_read(db_number, int(offset), 4)
                return round(struct.unpack('>f', data)[0], 3)
            else:
                return f"❌ Unsupported type: {dtype}"
        except Exception as e:
            return f"❌ Error: {e}"

    try:
        plc = connect_to_plc_fast()  # ✅ Persistent connection

        db499_fields = [
            ("scale_weight", "Real", 0),
            # SetPoints from PLC (sorted by offset)
            ("e11_selected", "Bool", 1.2),
            ("e10_selected", "Bool", 1.3),
            ("b1_deopt_emptying", "Bool", 1.4),
            ("mill_emptying", "Bool", 1.5),
            ("semolina_selected", "Bool", 254.0),
            ("mila_2_b789we_selected", "Bool", 296),
            ("order_scale_flowrate", "Real", 470),  # Order Scale Flowrate
            ("feeder_1_target", "Real", 478),
            ("feeder_1_selected", "Bool", 482),
            ("feeder_2_target", "Real", 484),
            ("feeder_2_selected", "Bool", 488),
            ("b1_scale1", "Bool", 490.0),
            ("b3_chocke_feeder", "Bool", 490.1),
            ("filter_flour_feeder", "Bool", 490.2),
            ("depot_selected", "Bool", 490.5),
            ("flap_1_selected", "Bool", 514),
            ("flap_2_selected", "Bool", 514.1),
            ("linning_running", "Bool", 532),
            ("linning_stopped", "Bool", 532.1),
            ("receiver_bin_id_1", "Int", 536),
            ("receiver_bin_id_2", "Int", 544),
            # Mill A Flour 2 Active Receiver IDs (additional offsets)
            ("flour2_receiver_bin_id_1", "Int", 172),
            ("flour2_receiver_bin_id_2", "Int", 214),
        ]

        db2099_fields = [
            ("mila_2_b789we", "Real", 96),
            ("yield_max_flow", "Real", 0),
            ("yield_min_flow", "Real", 0),  # same offset - correct offset is 0
            ("mila_unknown", "Real", 16),
            ("mila_bran_coarse", "Real", 20),  # % percentage value
            ("mila_flour_1", "Real", 24),  # % percentage value
            ("mila_b1", "Real", 28),  # % percentage value
            ("mila_bran_fine", "Real", 32),  # % percentage value
            ("mila_semolina", "Real", 36),  # % percentage value
            ("mila_B1_scale", "Real", 0),
            # ✅ Add job_status from DB2099 offset 104 (Bool)
            ("job_status", "Bool", 104),
        ]
        
        # ✅ Bran Receiver Non-Erasable Weights (DInt from DB2099)
        db2099_bran_fields = [
            ("bran_coarse", "DInt", 112),
            ("bran_fine", "DInt", 124),
            ("flour_1", "DInt", 116),
            ("b1", "DInt", 120),
            ("semolina", "DInt", 128),
        ]

        data_499 = {name: parse_field(plc, DB499, dtype, offset)
                    for name, dtype, offset in db499_fields}
        data_2099 = {name: parse_field(plc, DB2099, dtype, offset)
                     for name, dtype, offset in db2099_fields}
        
        # ✅ Convert job_status Bool to Int for compatibility
        if "job_status" in data_2099:
            job_status_bool = data_2099["job_status"]
            data_2099["job_status"] = 1 if job_status_bool else 0
            logger.info(f"[MILA] Job Status from DB2099 offset 104: {job_status_bool} (Bool) → {data_2099['job_status']} (Int) - {'order_active' if job_status_bool else 'order_done'}")

        # ✅ Read Bran Receiver Non-Erasable Weights from DB2099 (DInt values in kg)
        bran_receiver = {}
        for name, dtype, offset in db2099_bran_fields:
            value = parse_field(plc, DB2099, dtype, offset)  # ✅ Changed from DB499 to DB2099
            # Ensure we have a valid numeric value, default to 0 if error
            if isinstance(value, (int, float)):
                bran_receiver[name] = value
            else:
                logger.warning(f"Invalid bran_receiver value for {name}: {value}")
                bran_receiver[name] = 0
        
        # ✅ NO CONVERSION - Return raw PLC values in t/h for live monitor
        # All flow values remain in their original unit (t/h)
        # Bran Receiver values are in kg (DInt from DB2099)

        # F2 Scale Data (Mill A Flour 2 Scale) from DB2099
        f2_flow_rate_tph = parse_field(plc, DB2099, "Real", 176)   # 3_521WE_FlowRate, t/h
        f2_flow_percentage = parse_field(plc, DB2099, "Real", 180) # 3_521WE_Flow_Percentage, %
        f2_totalizer_kg = parse_field(plc, DB2099, "DInt", 184)    # 3_521WE_Totalizer, Kg
        if not isinstance(f2_flow_rate_tph, (int, float)):
            f2_flow_rate_tph = 0
        if not isinstance(f2_flow_percentage, (int, float)):
            f2_flow_percentage = 0
        if not isinstance(f2_totalizer_kg, (int, float)):
            f2_totalizer_kg = 0
        f2_scale = {
            "flow_rate_tph": f2_flow_rate_tph,
            "flow_percentage": f2_flow_percentage,
            "totalizer_kg": f2_totalizer_kg,
        }

        receiver_ids = [
            data_499.get("receiver_bin_id_1"),
            data_499.get("receiver_bin_id_2"),
            data_499.get("flour2_receiver_bin_id_1"),
            data_499.get("flour2_receiver_bin_id_2"),
        ]

        # plc.disconnect()  # ✅ No disconnect - keeping persistent connection

        # ✅ Fetch bin and material info from DB
        from contextlib import closing
        with closing(get_db_connection()) as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            # ✅ Query bins with bin_code to match PLC bin IDs
            cursor.execute("SELECT id, bin_name, bin_code, material_id FROM bins")
            all_bins = cursor.fetchall()

            # ✅ Create universal lookup: by bin_code (string), by bin_code (int), and by id
            bin_lookup = {}
            for b in all_bins:
                # Store by database id
                bin_lookup[b["id"]] = b
                # Store by bin_code (string)
                if b["bin_code"]:
                    bin_lookup[b["bin_code"]] = b
                    # Also store by bin_code (integer)
                    try:
                        int_key = int(b["bin_code"])
                        bin_lookup[int_key] = b
                    except (ValueError, TypeError):
                        pass
            
            # Get material IDs for receiver bins
            material_ids = []
            for receiver_id in receiver_ids:
                # Try to find bin with this id/code
                bin_info = (bin_lookup.get(receiver_id) or 
                           bin_lookup.get(str(receiver_id)) or 
                           bin_lookup.get(int(receiver_id) if isinstance(receiver_id, str) and receiver_id.isdigit() else None))
                if bin_info and bin_info.get("material_id"):
                    material_ids.append(bin_info["material_id"])
            
            material_map = {}
            if material_ids:
                cursor.execute("""
                    SELECT id, material_name, material_code
                    FROM materials
                    WHERE id IN %s
                """, (tuple(set(material_ids)),))
                for row in cursor.fetchall():
                    material_map[row["id"]] = row

        enriched_receivers = []
        for bin_id in receiver_ids:
            entry = {
                "bin_id": bin_id,
                "material": None
            }
            # ✅ Try multiple lookup strategies (handles int, string, db id)
            bin_info = (bin_lookup.get(bin_id) or 
                       bin_lookup.get(str(bin_id)) or 
                       bin_lookup.get(int(bin_id) if isinstance(bin_id, str) and bin_id.isdigit() else None))
            
            if bin_info:
                mat_id = bin_info.get("material_id")
                if mat_id and mat_id in material_map:
                    entry["material"] = material_map[mat_id]
            enriched_receivers.append(entry)

        return jsonify({
            "status": "success",
            "DB499": data_499,
            "DB2099": data_2099,
            "bran_receiver": bran_receiver,  # ✅ Bran Receiver Non-Erasable Weights in kg
            "f2_scale": f2_scale,  # F2 Scale (Mill A Flour 2) from DB2099 offsets 176, 180, 184
            "receiver_bins": enriched_receivers
        }), 200

    except Exception as e:
        logger.exception("Error in /plc/db499-db2099-monitor")
        return jsonify({"status": "error", "message": str(e)}), 500


# ARCHIVE APIs (Hourly & Full)
# ================================
from flask import jsonify
from psycopg2.extras import RealDictCursor

# --- FCL APIs ---

@orders_bp.route('/archive/fcl/latest', methods=['GET'])
@handle_db_errors
def get_fcl_latest():
    """
    Get the latest FCL archive record.
    Returns the most recent record regardless of line_running status
    to ensure FCL_2_520WE values are always accessible.
    """
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT * FROM fcl_monitor_logs_archive
                ORDER BY created_at DESC
                LIMIT 1
            """)
            row = cursor.fetchone()
            return jsonify({'status': 'success', 'data': row}), 200


@orders_bp.route('/archive/fcl/full', methods=['GET'])
@handle_db_errors
def get_fcl_full():
    """
    Get FCL archive records.
    Optional: start_date, end_date (both = all in range); line_running (true/false).
    If start_date/end_date both missing: last 100 (DESC LIMIT 100, returned ASC).
    """
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    line_running_filter = request.args.get('line_running')
    line_running_bool = None
    if line_running_filter is not None:
        line_running_bool = line_running_filter.lower() in ('true', '1', 'yes')

    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            if start_date and end_date:
                import pytz
                start_parsed = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                end_parsed = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                dubai_tz = pytz.timezone('Asia/Dubai')
                start_dubai = start_parsed.astimezone(dubai_tz).replace(tzinfo=None)
                end_dubai = end_parsed.astimezone(dubai_tz).replace(tzinfo=None)
                if line_running_bool is not None:
                    cursor.execute("""
                        SELECT * FROM fcl_monitor_logs_archive
                        WHERE created_at >= %s AND created_at <= %s AND line_running = %s
                        ORDER BY created_at ASC
                    """, (start_dubai, end_dubai, line_running_bool))
                else:
                    cursor.execute("""
                        SELECT * FROM fcl_monitor_logs_archive
                        WHERE created_at >= %s AND created_at <= %s
                        ORDER BY created_at ASC
                    """, (start_dubai, end_dubai))
                rows = cursor.fetchall()
            else:
                if line_running_bool is not None:
                    cursor.execute("""
                        SELECT * FROM fcl_monitor_logs_archive
                        WHERE line_running = %s
                        ORDER BY created_at DESC
                        LIMIT 100
                    """, (line_running_bool,))
                else:
                    cursor.execute("""
                        SELECT * FROM fcl_monitor_logs_archive
                        ORDER BY created_at DESC
                        LIMIT 100
                    """)
                rows = cursor.fetchall()
                rows = list(reversed(rows))  # ASC for UI
            out = []
            for r in rows:
                row = dict(r)
                for dt_col in ('created_at', 'order_start_time', 'order_end_time'):
                    if row.get(dt_col) is not None and hasattr(row[dt_col], 'isoformat'):
                        row[dt_col] = row[dt_col].isoformat()
                out.append(row)
            return jsonify({'status': 'success', 'data': out}), 200

# --- SCL APIs ---

@orders_bp.route('/archive/scl/latest', methods=['GET'])
@handle_db_errors
def get_scl_latest():
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT * FROM scl_monitor_logs_archive
                ORDER BY created_at DESC
                LIMIT 1
            """)
            row = cursor.fetchone()
            return jsonify({'status': 'success', 'data': row}), 200


@orders_bp.route('/archive/scl/full', methods=['GET'])
@handle_db_errors
def get_scl_full():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            if start_date and end_date:
                import pytz
                start_parsed = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                end_parsed = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                dubai_tz = pytz.timezone('Asia/Dubai')
                start_dubai = start_parsed.astimezone(dubai_tz).replace(tzinfo=None)
                end_dubai = end_parsed.astimezone(dubai_tz).replace(tzinfo=None)
                cursor.execute("""
                    SELECT * FROM scl_monitor_logs_archive
                    WHERE created_at >= %s AND created_at <= %s
                    ORDER BY created_at ASC
                """, (start_dubai, end_dubai))
                rows = cursor.fetchall()
            else:
                cursor.execute("""
                    SELECT * FROM scl_monitor_logs_archive
                    ORDER BY created_at DESC
                    LIMIT 100
                """)
                rows = cursor.fetchall()
                rows = list(reversed(rows))  # ASC for UI
            out = []
            for r in rows:
                row = dict(r)
                for dt_col in ('created_at', 'order_start_time', 'order_end_time'):
                    if row.get(dt_col) is not None and hasattr(row[dt_col], 'isoformat'):
                        row[dt_col] = row[dt_col].isoformat()
                out.append(row)
            return jsonify({'status': 'success', 'data': out}), 200

# --- MILA APIs ---

@orders_bp.route('/mila/archive/latest', methods=['GET'])
def get_latest_mila_archive():
    try:
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT *
                    FROM mila_monitor_logs_archive
                    ORDER BY created_at DESC
                    LIMIT 1
                """)
                row = cur.fetchone()
                if not row:
                    return jsonify({"status": "error", "message": "No archive data found"}), 404
                return jsonify({"status": "success", "data": row}), 200
    except Exception as e:
        logger.error("❌ Error fetching latest MILA archive", exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500


@orders_bp.route('/mila/archive/all', methods=['GET'])
def get_all_mila_archive():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    limit_param = request.args.get('limit', type=int)
    limit = min(max(limit_param or 500, 1), 10000)  # default 500, cap 10000 for job list
    try:
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                if start_date and end_date:
                    import pytz
                    start_parsed = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                    end_parsed = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                    dubai_tz = pytz.timezone('Asia/Dubai')
                    start_dubai = start_parsed.astimezone(dubai_tz).replace(tzinfo=None)
                    end_dubai = end_parsed.astimezone(dubai_tz).replace(tzinfo=None)
                    cur.execute("""
                        SELECT * FROM mila_monitor_logs_archive
                        WHERE created_at >= %s AND created_at <= %s
                        ORDER BY created_at ASC
                    """, (start_dubai, end_dubai))
                    rows = cur.fetchall()
                else:
                    # Fetch latest rows (limit for dropdown or job list; many rows per order)
                    cur.execute("""
                        SELECT * FROM mila_monitor_logs_archive
                        ORDER BY created_at DESC
                        LIMIT %s
                    """, (limit,))
                    rows = cur.fetchall()
                    rows = list(reversed(rows))  # ASC for UI
                # Serialize datetime columns to ISO string for frontend
                out = []
                for r in rows:
                    row = dict(r)
                    for dt_col in ('created_at', 'order_start_time', 'order_end_time'):
                        if row.get(dt_col) is not None and hasattr(row[dt_col], 'isoformat'):
                            row[dt_col] = row[dt_col].isoformat()
                    out.append(row)
                return jsonify({"status": "success", "data": out}), 200
    except Exception as e:
        logger.error("❌ Error fetching MILA archive", exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500
    
@orders_bp.route('/mila/archive/latest-10', methods=['GET'])
def get_latest_10_mila_archive():
    try:
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Step 1: Count total rows
                cur.execute("SELECT COUNT(*) FROM mila_monitor_logs_archive")
                total_count = cur.fetchone()['count']

                # Step 2: Compute offset (total - 10, but not less than 0)
                offset = max(total_count - 10, 0)

                # Step 3: Fetch last 10 records in correct order
                cur.execute("""
                    SELECT *
                    FROM mila_monitor_logs_archive
                    ORDER BY created_at
                    OFFSET %s LIMIT 10
                """, (offset,))

                rows = cur.fetchall()
                return jsonify({"status": "success", "data": rows}), 200
    except Exception as e:
        logger.error("❌ Error fetching latest 10 MILA archive records", exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500


@orders_bp.route('/mila/archive/summary', methods=['GET'])
def get_mila_archive_summary():
    """
    ✅ DELTA-BASED MILA Summary (for Reports). Requires start_date and end_date; optional order_name filter.
    Can also be invoked from analytics with g.analytics_mila set.
    """
    from flask import request, jsonify, g
    from datetime import datetime, timedelta
    import json
    try:
        use_analytics = g.pop('analytics_mila', None)
        if use_analytics:
            start_with_buffer, end_with_buffer, order_name, is_daily_or_longer = use_analytics
            start_dubai = start_with_buffer
            end_dubai = end_with_buffer
        else:
            start_date = request.args.get('start_date')
            end_date = request.args.get('end_date')
            order_name = request.args.get('order_name')

            if not start_date or not end_date:
                return jsonify({"status": "error", "message": "start_date and end_date are required"}), 400

            from datetime import datetime, timedelta
            import pytz
            dubai_tz = pytz.timezone('Asia/Dubai')
            start_parsed = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            end_parsed = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            start_dubai = start_parsed.astimezone(dubai_tz).replace(tzinfo=None)
            end_dubai = end_parsed.astimezone(dubai_tz).replace(tzinfo=None)
            time_diff = end_dubai - start_dubai
            is_daily_or_longer = time_diff >= timedelta(hours=23, minutes=59)
            if is_daily_or_longer:
                start_dubai = start_dubai - timedelta(hours=1)
                end_dubai = end_dubai - timedelta(hours=1)
            start_with_buffer = start_dubai
            if is_daily_or_longer:
                end_with_buffer = end_dubai
            else:
                end_with_buffer = end_dubai + timedelta(minutes=5)

        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                if not use_analytics:
                    # First, check what records exist in the table
                    cur.execute("""
                        SELECT 
                            MIN(created_at) as earliest,
                            MAX(created_at) as latest,
                            COUNT(*) as total
                        FROM mila_monitor_logs_archive
                    """)
                    table_stats = cur.fetchone()
                    logger.info(f"📊 [MIL-A Summary] Table has {table_stats['total']} total records from {table_stats['earliest']} to {table_stats['latest']}")
                
                # Query archived data (ordered by created_at ASC)
                start_dubai = start_with_buffer
                end_dubai = end_with_buffer
                
                if not use_analytics:
                    logger.info(f"🕐 [MIL-A Summary] Using Dubai time (with 5-min buffer):")
                    logger.info(f"  - start_dubai: {start_dubai}")
                    logger.info(f"  - end_dubai: {end_dubai}")
                
                # ✅ Execute query with detailed logging
                # Build query with optional order_name filter
                if order_name:
                    query = """
                        SELECT *
                        FROM mila_monitor_logs_archive
                        WHERE created_at >= %s
                          AND created_at <= %s
                          AND order_name = %s
                        ORDER BY created_at ASC
                    """
                    query_params = (start_dubai, end_dubai, order_name)
                else:
                    query = """
                        SELECT *
                        FROM mila_monitor_logs_archive
                        WHERE created_at >= %s
                          AND created_at <= %s
                        ORDER BY created_at ASC
                    """
                    query_params = (start_dubai, end_dubai)
                
                logger.info(f"🔍 [MIL-A Summary] Executing query:")
                logger.info(f"  SQL: {query}")
                logger.info(f"  Params: start={start_dubai}, end={end_dubai}, order_name={order_name}")
                
                cur.execute(query, query_params)
                rows = cur.fetchall()
                
                logger.info(f"📊 [MIL-A Summary] Found {len(rows)} rows in range {start_dubai} to {end_dubai}")
                
                # Always show what we found
                if rows:
                    logger.info(f"📊 [MIL-A Summary] ✅ Found {len(rows)} matching record(s):")
                    for idx, r in enumerate(rows):
                        logger.info(f"  {idx+1}. ID {r.get('id')}: {r.get('order_name')} at {r.get('created_at')}")
                else:
                    logger.warning(f"📊 [MIL-A Summary] ⚠️ No records found in database for this range!")
                
                # Always show nearby records for comparison
                cur.execute("""
                    SELECT id, order_name, created_at 
                    FROM mila_monitor_logs_archive 
                    WHERE created_at >= %s - INTERVAL '2 hours'
                      AND created_at <= %s + INTERVAL '2 hours'
                    ORDER BY created_at ASC
                """, (start_dubai, end_dubai))
                nearby = cur.fetchall()
                logger.info(f"📊 [MIL-A Summary] Records within ±2 hours of range:")
                for r in nearby:
                    in_range = start_dubai <= r['created_at'] <= end_dubai
                    marker = "✅" if in_range else "  "
                    logger.info(f"  {marker} ID {r['id']}: {r['order_name']} at {r['created_at']}")

        all_rows = rows

        record_count = len(all_rows)
        
        if record_count < 1:
            logger.info("📊 [MIL-A Summary] No records in range; returning 200 with empty summary")
            return jsonify({
                "status": "success",
                "summary": {"error": True, "message": "No records found in selected time range"}
            }), 200

        # ✅ FIX: Get FIRST and LAST records for delta calculation
        # Use records within EXACT time range (not buffer range) for accurate delta calculation
        # This ensures we calculate delta from the actual requested time period
        # For MILA: start_dubai and end_dubai are already shifted by -1 hour (5 AM -> 4:00 AM) for daily reports
        # For hourly reports: Include records slightly after end time (e.g., 1:02 PM) to catch delayed records
        # Add 5 minute buffer to end time for hourly reports to include records that are slightly delayed
        if is_daily_or_longer:
            # Daily reports: Use exact end time (no buffer needed)
            exact_end_time = end_dubai + timedelta(seconds=59)
        else:
            # Hourly/multi-hour reports: Add 5 minute buffer to catch records slightly after end time
            # Example: 12 PM to 1 PM should include records up to 1:05 PM
            exact_end_time = end_dubai + timedelta(minutes=5)
            logger.info(f"📊 [MIL-A Summary] Hourly report - adding 5 minute buffer to end time: {end_dubai} -> {exact_end_time}")
        
        exact_rows = [r for r in all_rows if start_dubai <= r.get('created_at') <= exact_end_time]
        
        if exact_rows:
            first_record = exact_rows[0]
            last_record = exact_rows[-1]
            logger.info(f"📊 [MIL-A Delta] Using EXACT time range: First: {first_record.get('created_at')}, Last: {last_record.get('created_at')}")
            logger.info(f"📊 [MIL-A Delta] Found {len(exact_rows)} records in exact time range (out of {len(all_rows)} total with buffer)")
        else:
            # Fallback to buffer range if no exact matches (shouldn't happen normally)
            first_record = all_rows[0]
            last_record = all_rows[-1]
            logger.warning(f"📊 [MIL-A Delta] No records in exact time range, using buffer range: First: {first_record.get('created_at')}, Last: {last_record.get('created_at')}")

        logger.info(f"📊 [MIL-A Delta] Final: First: {first_record.get('created_at')}, Last: {last_record.get('created_at')}")

        # ✅ MILA-SPECIFIC: For hourly reports, always calculate delta when there are 2+ records
        # For single record only, show that record's values directly
        # Example: 12 PM to 1 PM should get 2 records (12 PM and 1 PM) and calculate delta (last - first)
        is_single_record = (len(exact_rows) == 1) if exact_rows else (first_record.get('id') == last_record.get('id'))
        
        # Log record count for debugging
        num_records = len(exact_rows) if exact_rows else (1 if first_record.get('id') == last_record.get('id') else 2)
        logger.info(f"📊 [MIL-A Summary] Records in exact time range: {num_records} (First: {first_record.get('created_at')}, Last: {last_record.get('created_at')})")
        if num_records >= 2:
            logger.info(f"📊 [MIL-A Summary] Multiple records detected - will calculate delta (last - first) for hourly report")
        else:
            logger.info(f"📊 [MIL-A Summary] Single record detected - will show record values directly")
        
        if is_single_record:
            # Single record: Show record's values directly (not delta)
            logger.info(f"📊 [MIL-A Summary] Single record detected - showing record values directly")
            total_produced_weight = float(first_record.get("produced_weight") or 0)
            
            # For cumulative counters with single record, we can't calculate delta
            # So we'll use the record's values directly (not 0)
            first_bran = first_record.get("bran_receiver")
            if isinstance(first_bran, str):
                first_bran = json.loads(first_bran or "{}")
            if first_bran is None:
                first_bran = {}
            
            bran_receiver_totals = {}
            for key, val in first_bran.items():
                # For single record, show the record's cumulative value directly
                # Note: This is the cumulative value, not a delta
                bran_receiver_totals[key] = round(float(val) if isinstance(val, (int, float)) else 0, 3)
                logger.info(f"📊 [MIL-A Bran] {key}: Single record - showing value directly: {bran_receiver_totals[key]:,.1f}")
            
            # Receiver: use receiver array for bin list/labels; weights from bran_receiver (F1, F2 Scale)
            first_receivers = first_record.get("receiver")
            if isinstance(first_receivers, str):
                first_receivers = json.loads(first_receivers or "[]")
            if first_receivers is None:
                first_receivers = []
            f1_kg = bran_receiver_totals.get("MILA_Flour1 (kg)") or bran_receiver_totals.get("MILA_Flour1") or 0
            f2_kg = bran_receiver_totals.get("F2 Scale (kg)") or bran_receiver_totals.get("F2 Scale") or 0
            receiver_weight_totals = {}
            for idx, rec in enumerate(first_receivers):
                bin_id = rec.get("bin_id")
                mat_code = rec.get("material_code")
                mat_name = rec.get("material_name") or (f"Receiver {mat_code}" if mat_code else "Unknown")
                key = str(bin_id) if bin_id is not None else (mat_code or "unknown")
                if idx == 0:
                    weight_kg = f1_kg  # First receiver bin = F1 (MILA_Flour1)
                elif idx == 1:
                    weight_kg = f2_kg  # Second receiver bin = F2 Scale
                else:
                    weight_kg = 0
                receiver_weight_totals[key] = {
                    "bin_id": bin_id,
                    "material_code": mat_code,
                    "material_name": mat_name,
                    "weight_kg": round(float(weight_kg), 3)
                }
            
        else:
            # Multiple records: Calculate delta (last - first)
            logger.info(f"📊 [MIL-A Summary] Multiple records detected ({len(exact_rows) if exact_rows else 'unknown'} records) - calculating delta")
            
            # ✅ Calculate DELTA for produced weight
            first_produced = float(first_record.get("produced_weight") or 0)
            last_produced = float(last_record.get("produced_weight") or 0)
            total_produced_weight = last_produced - first_produced

            # ✅ Calculate DELTA for bran_receiver (cumulative counters)
            first_bran = first_record.get("bran_receiver")
            last_bran = last_record.get("bran_receiver")
            
            if isinstance(first_bran, str):
                first_bran = json.loads(first_bran or "{}")
            if isinstance(last_bran, str):
                last_bran = json.loads(last_bran or "{}")
            
            bran_receiver_totals = {}
            for key in last_bran.keys():
                last_val = float(last_bran.get(key) or 0)
                first_val = float(first_bran.get(key) or 0)
                delta = last_val - first_val
                bran_receiver_totals[key] = round(delta, 3)
                logger.info(f"📊 [MIL-A Bran] {key}: {first_val:,.1f} -> {last_val:,.1f} = {delta:,.1f} kg")

            # Receiver: use receiver array for bin list/labels; weights from bran_receiver (F1, F2 Scale)
            last_receivers = last_record.get("receiver")
            if isinstance(last_receivers, str):
                last_receivers = json.loads(last_receivers or "[]")
            if last_receivers is None:
                last_receivers = []
            f1_kg = bran_receiver_totals.get("MILA_Flour1 (kg)") or bran_receiver_totals.get("MILA_Flour1") or 0
            f2_kg = bran_receiver_totals.get("F2 Scale (kg)") or bran_receiver_totals.get("F2 Scale") or 0
            receiver_weight_totals = {}
            for idx, rec in enumerate(last_receivers):
                bin_id = rec.get("bin_id")
                mat_code = rec.get("material_code")
                mat_name = rec.get("material_name") or (f"Receiver {mat_code}" if mat_code else "Unknown")
                key = str(bin_id) if bin_id is not None else (mat_code or "unknown")
                if idx == 0:
                    weight_kg = f1_kg  # First receiver bin = F1 (MILA_Flour1)
                elif idx == 1:
                    weight_kg = f2_kg  # Second receiver bin = F2 Scale
                else:
                    weight_kg = 0
                receiver_weight_totals[key] = {
                    "bin_id": bin_id,
                    "material_code": mat_code,
                    "material_name": mat_name,
                    "weight_kg": round(float(weight_kg), 3)
                }
            logger.info(f"📊 [MIL-A Summary] Receiver weights (F1/F2): {receiver_weight_totals}")

        # Get yield_log and setpoints from last record (current values)
        last_yield_log = last_record.get("yield_log")
        last_setpoints = last_record.get("setpoints_produced")
        
        if isinstance(last_yield_log, str):
            last_yield_log = json.loads(last_yield_log or "{}")
        if isinstance(last_setpoints, str):
            last_setpoints = json.loads(last_setpoints or "{}")
        
        # Extract flow values and percentages
        average_yield_flows = {}
        average_yield_log = {}
        for k, v in last_yield_log.items():
            if isinstance(v, (int, float)):
                if "Flow" in k:
                    average_yield_flows[k] = round(v, 3)
                else:
                    average_yield_log[k] = round(v, 3)
        
        average_setpoints_percentages = {k: round(v, 3) for k, v in last_setpoints.items() if isinstance(v, (int, float))}

        # Use real order times if available, fall back to created_at for old data
        all_start_times = [r.get("order_start_time") for r in exact_rows if r.get("order_start_time")]
        all_end_times = [r.get("order_end_time") for r in exact_rows if r.get("order_end_time")]
        real_start = min(all_start_times) if all_start_times else first_record.get("created_at")
        real_end = max(all_end_times) if all_end_times else last_record.get("created_at")

        summary_response = {
            "record_count": record_count,
            "total_produced_weight": round(total_produced_weight, 3),
            "average_yield_log": average_yield_log,
            "average_setpoints_percentages": average_setpoints_percentages,
            "average_yield_flows": average_yield_flows,
                "bran_receiver_totals": bran_receiver_totals,
                "receiver_weight_totals": receiver_weight_totals,
            "start_time": real_start,
            "end_time": real_end,
        }
        
        logger.info(f"📊 [MIL-A Summary] Sending bran_receiver_totals: {bran_receiver_totals}")
        logger.info(f"📊 [MIL-A Summary] Total bran: {sum(bran_receiver_totals.values()):,.1f} kg")
        
        return jsonify({
            "status": "success",
            "summary": summary_response
        }), 200

    except Exception as e:
        logger.error("❌ Error summarizing MILA archive", exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500


@orders_bp.route('/analytics/mila/summary', methods=['GET'])
@handle_db_errors
def get_mila_analytics_summary():
    """
    Order Analytics: MIL-A summary by order_name. Requires order_name; optional start_date/end_date.
    If dates omitted, uses full order range. Reports use archive/summary only.
    """
    from flask import request, jsonify, g
    from datetime import datetime, timedelta

    order_name = request.args.get('order_name')
    if not order_name:
        return jsonify({"status": "error", "message": "order_name is required"}), 400

    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if start_date and end_date:
        import pytz
        dubai_tz = pytz.timezone('Asia/Dubai')
        start_parsed = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        end_parsed = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        start_dubai = start_parsed.astimezone(dubai_tz).replace(tzinfo=None)
        end_dubai = end_parsed.astimezone(dubai_tz).replace(tzinfo=None)
        time_diff = end_dubai - start_dubai
        is_daily_or_longer = time_diff >= timedelta(hours=23, minutes=59)
        if is_daily_or_longer:
            start_dubai = start_dubai - timedelta(hours=1)
            end_dubai = end_dubai - timedelta(hours=1)
        start_with_buffer = start_dubai
        end_with_buffer = end_dubai + (timedelta(minutes=5) if not is_daily_or_longer else timedelta(0))
    else:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT
                        COALESCE(MIN(order_start_time), MIN(created_at)),
                        COALESCE(MAX(order_end_time), MAX(created_at))
                    FROM mila_monitor_logs_archive WHERE order_name = %s""",
                    (order_name,),
                )
                row = cur.fetchone()
        if not row or row[0] is None:
            return jsonify({
                "status": "success",
                "summary": {"error": True, "message": "No records found for this order"}
            }), 200
        start_with_buffer, end_with_buffer = row[0], row[1]
        is_daily_or_longer = False

    g.analytics_mila = (start_with_buffer, end_with_buffer, order_name, is_daily_or_longer)
    return get_mila_archive_summary()


def _run_scl_summary(start_dubai, end_dubai, order_name=None):
    """Shared SCL summary logic: query archive by range (and optional order_name) and return JSON response."""
    import json
    from collections import defaultdict

    logger.info(f"🕐 [SCL Summary] Querying range (Dubai time): {start_dubai} to {end_dubai}")

    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if order_name:
                cur.execute("""
                    SELECT *
                    FROM scl_monitor_logs_archive
                    WHERE created_at >= %s
                      AND created_at <= %s
                      AND order_name = %s
                    ORDER BY created_at ASC
                """, (start_dubai, end_dubai, order_name))
            else:
                cur.execute("""
                    SELECT *
                    FROM scl_monitor_logs_archive
                    WHERE created_at >= %s
                      AND created_at <= %s
                    ORDER BY created_at ASC
                """, (start_dubai, end_dubai))
            rows = cur.fetchall()

    record_count = len(rows)
    
    if record_count < 1:
        logger.info("📊 [SCL Summary] No records in range; returning 200 with empty summary")
        return jsonify({
            "status": "success",
            "summary": {"error": True, "message": "No records found in selected time range"}
        }), 200

    # Get LAST record for current values (flow rate, setpoints, etc.)
    last_record = rows[-1]
    
    # ✅ Debug: Show all record timestamps and flow_rate values
    logger.info(f"📊 [SCL Summary] Found {record_count} records:")
    for i, r in enumerate(rows):
        flow_rate_debug = r.get('flow_rate') if 'flow_rate' in r else (r.get('Flowrate') if 'Flowrate' in r else 'N/A')
        logger.info(f"   Record {i+1}: created_at={r.get('created_at')}, receiver={r.get('receiver')}, flow_rate={flow_rate_debug}, per_bin_weights={r.get('per_bin_weights')}")
    
    # ✅ Debug: Show last record keys to diagnose field name issues
    if last_record:
        logger.info(f"🔍 [SCL Summary] Last record keys: {list(last_record.keys())}")
        logger.info(f"🔍 [SCL Summary] Last record flow_rate (direct): {last_record.get('flow_rate')}")
        logger.info(f"🔍 [SCL Summary] Last record flow_rate (dict access): {dict(last_record).get('flow_rate') if isinstance(last_record, dict) else 'N/A'}")

    # ✅ SUM produced_weight across all records (hourly totals - like FCL)
    total_produced_weight = sum(float(r.get('produced_weight') or 0) for r in rows)
    logger.info(f"📊 [SCL Summary] Produced weight (sum): {total_produced_weight} kg from {record_count} records")

    # ✅ SUM receiver across all records (hourly totals - like FCL)
    total_receiver_weight = sum(float(r.get('receiver') or 0) for r in rows)
    logger.info(f"📊 [SCL Summary] Receiver weight (sum): {total_receiver_weight} kg")

    # ✅ SUM per_bin_weights across all records (like FCL)
    from collections import defaultdict
    bin_weight_totals = defaultdict(float)
    for r in rows:
        current_bins = r.get("per_bin_weights")
        if isinstance(current_bins, str):
            current_bins = json.loads(current_bins or "[]")
        
        # Handle both formats:
        # 1. List format: [{"bin_id": 27, "total_weight": 771.222}, ...]
        # 2. Dict format: {"27": 771.222, "29": 5183.214} (older records)
        if isinstance(current_bins, list):
            for b in current_bins:
                bin_id = b.get("bin_id")
                weight = float(b.get("total_weight") or 0)
                bin_weight_totals[f"bin_{bin_id}"] += weight
        elif isinstance(current_bins, dict):
            for bin_id, weight in current_bins.items():
                bin_weight_totals[f"bin_{bin_id}"] += float(weight or 0)
    
    # Convert to regular dict with rounded values
    bin_weight_totals = {k: round(v, 3) for k, v in bin_weight_totals.items()}
    logger.info(f"📊 [SCL Summary] Per-bin totals (sum): {bin_weight_totals}")

    # Get setpoints from last record (current values)
    # ✅ Find the most recent non-zero flow_rate value (for display in report)
    # This ensures we show the actual flow rate when the system was running, not 0.0 when stopped
    flow_rate_value = None
    
    # Search backwards through all records to find the most recent non-zero flow_rate
    # This handles cases where the last record has flow_rate=0.0 (system stopped)
    for record in reversed(rows):  # Search from last to first
        if isinstance(record, dict):
            # Try multiple field name variations
            candidate = record.get('flow_rate')
            if candidate is None:
                candidate = record.get('Flowrate')
            if candidate is None:
                candidate = record.get('FlowRate')
            if candidate is None:
                candidate = record.get('flowrate')
            
            # Use the first non-NULL, non-zero value we find (most recent)
            if candidate is not None:
                try:
                    candidate_float = float(candidate)
                    if candidate_float != 0.0:
                        flow_rate_value = candidate_float
                        logger.info(f"✅ [SCL Summary] Found flow_rate={flow_rate_value} in record at {record.get('created_at')}")
                        break
                    elif flow_rate_value is None:
                        # Store the first value we find (even if 0) as fallback
                        flow_rate_value = candidate_float
                except (ValueError, TypeError):
                    pass
    
    # If we still don't have a value, default to 0
    if flow_rate_value is None:
        flow_rate_value = 0.0
        logger.warning(f"⚠️ [SCL Summary] No valid flow_rate found in any record")
    
    average_flow_rate = float(flow_rate_value)
    logger.info(f"✅ [SCL Summary] Final flow_rate value: {average_flow_rate}")
    
    average_moisture_offset = float(last_record.get('moisture_offset') or 0)
    average_moisture_setpoint = float(last_record.get('moisture_setpoint') or 0)

    # ✅ Extract material names from active_sources for sender bins (aggregate from ALL records)
    material_summary = {}
    
    for record in rows:
        sources = record.get("active_sources")
        if isinstance(sources, str):
            sources = json.loads(sources or "[]")
        
        for source in sources:
            bin_id = source.get("bin_id")
            
            # Try multiple ways to get material name
            material_name = None
            
            # 1. Try nested material.material_name (Most reliable)
            material = source.get("material")
            if material and isinstance(material, dict):
                material_name = material.get("material_name")
            else:
                # 2. Fallback to prd_name
                material_name = source.get("prd_name")
            
            # Store material name for this bin
            if material_name and bin_id and material_name != "N/A":
                material_summary[f"bin_{bin_id}"] = material_name
    
    logger.info(f"[SCL Summary] Extracted {len(material_summary)} material names from active_sources")
    
    # ✅ For bins in per_bin_weight_totals that don't have material names, query the database
    missing_bins = [k for k in bin_weight_totals.keys() if k not in material_summary]
    if missing_bins:
        logger.info(f"[SCL Summary] Looking up material names for bins: {missing_bins}")
        try:
            # Extract bin IDs from keys like "bin_27" -> 27
            bin_ids = [int(k.replace("bin_", "")) for k in missing_bins]
            
            # Query bins table with material join
            cur.execute("""
                SELECT b.id, b.bin_name, m.material_name 
                FROM bins b 
                LEFT JOIN materials m ON b.material_id = m.id 
                WHERE b.id = ANY(%s)
            """, (bin_ids,))
            
            for row in cur.fetchall():
                bin_id = row.get('id')
                material_name = row.get('material_name') or row.get('bin_name') or f"Bin {bin_id}"
                material_summary[f"bin_{bin_id}"] = material_name
                logger.info(f"[SCL Summary] Added material for bin_{bin_id}: {material_name}")
        except Exception as e:
            logger.warning(f"[SCL Summary] Error querying bin materials: {e}")
    
    logger.info(f"[SCL Summary] Final material_summary: {material_summary}")

    # ✅ Extract receiver material info from active_destination
    receiver_weight_totals = {}
    receiver_bin_id = None  # ✅ Store bin ID for frontend
    receiver_material_name = None
    
    # Iterate all records to find valid receiver info
    for record in rows:
        dest = record.get("active_destination")
        if isinstance(dest, str):
            dest = json.loads(dest or "{}")
        
        if dest and isinstance(dest, dict):
            if dest.get("bin_id"):
                receiver_bin_id = dest.get("bin_id")
            
            # Try to get material name
            mat_name = None
            if dest.get("material") and isinstance(dest.get("material"), dict):
                mat_name = dest.get("material", {}).get("material_name")
            elif dest.get("prd_name"):
                mat_name = dest.get("prd_name")
            
            if mat_name:
                receiver_material_name = mat_name
                if dest.get("material"):
                    break
    
    # ✅ For SCL: Receiver weight = Sender weight (Input = Output)
    sender_total = sum(bin_weight_totals.values())
    if total_receiver_weight == 0 and sender_total > 0:
        total_receiver_weight = sender_total
        logger.info(f"[SCL Summary] ✅ Receiver weight set to sender total: {total_receiver_weight} kg")
    
    # Build receiver_weight_totals with actual weight
    if receiver_material_name:
        receiver_weight_totals = {receiver_material_name: round(total_receiver_weight, 3)}
    elif total_receiver_weight > 0:
        receiver_weight_totals = {"Output": round(total_receiver_weight, 3)}
    
    logger.info(f"[SCL Summary] Receiver bin {receiver_bin_id} → {receiver_weight_totals}")

    # Response
    return jsonify({
        "status": "success",
        "summary": {
            "record_count": record_count,
            "total_produced_weight": round(total_produced_weight, 3),
            "total_receiver_weight": round(total_receiver_weight, 3),
            "average_flow_rate": round(average_flow_rate, 3),
            "average_moisture_offset": round(average_moisture_offset, 3),
            "average_moisture_setpoint": round(average_moisture_setpoint, 3),
            "per_bin_weight_totals": bin_weight_totals,
            "material_summary": material_summary,
            "receiver_weight": receiver_weight_totals,
            "receiver_bin_id": receiver_bin_id,
            "start_time": min([r.get("order_start_time") for r in rows if r.get("order_start_time")], default=rows[0].get("created_at")),
            "end_time": max([r.get("order_end_time") for r in rows if r.get("order_end_time")], default=last_record.get("created_at"))
        }
    }), 200


@orders_bp.route('/scl/archive/summary', methods=['GET'])
@handle_db_errors
def get_scl_archive_summary():
    """
    ✅ SUMMATION-BASED SCL Summary (for Reports). Requires start_date and end_date; optional order_name filter.
    """
    from flask import request, jsonify
    from datetime import datetime, timedelta

    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    order_name = request.args.get('order_name')

    if not start_date or not end_date:
        return jsonify({"status": "error", "message": "start_date and end_date are required"}), 400

    import pytz
    dubai_tz = pytz.timezone('Asia/Dubai')
    start_parsed = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
    end_parsed = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
    start_dubai = start_parsed.astimezone(dubai_tz).replace(tzinfo=None) + timedelta(minutes=1)
    end_dubai = end_parsed.astimezone(dubai_tz).replace(tzinfo=None) + timedelta(minutes=5)
    return _run_scl_summary(start_dubai, end_dubai, order_name)


@orders_bp.route('/analytics/scl/summary', methods=['GET'])
@handle_db_errors
def get_scl_analytics_summary():
    """
    Order Analytics: SCL summary by order_name. Requires order_name; optional start_date/end_date.
    If dates omitted, uses full order range (MIN/MAX created_at). Reports use archive/summary only.
    """
    from flask import request, jsonify
    from datetime import datetime, timedelta

    order_name = request.args.get('order_name')
    if not order_name:
        return jsonify({"status": "error", "message": "order_name is required"}), 400

    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if start_date and end_date:
        import pytz
        dubai_tz = pytz.timezone('Asia/Dubai')
        start_parsed = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        end_parsed = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        start_dubai = start_parsed.astimezone(dubai_tz).replace(tzinfo=None) + timedelta(minutes=1)
        end_dubai = end_parsed.astimezone(dubai_tz).replace(tzinfo=None) + timedelta(minutes=5)
    else:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT
                        COALESCE(MIN(order_start_time), MIN(created_at)),
                        COALESCE(MAX(order_end_time), MAX(created_at))
                    FROM scl_monitor_logs_archive WHERE order_name = %s""",
                    (order_name,),
                )
                row = cur.fetchone()
        if not row or row[0] is None:
            return jsonify({
                "status": "success",
                "summary": {"error": True, "message": "No records found for this order"}
            }), 200
        start_dubai, end_dubai = row[0], row[1]

    return _run_scl_summary(start_dubai, end_dubai, order_name)


def _run_fcl_summary(start_dubai, end_dubai, order_name, start_with_buffer, end_with_buffer):
    """Shared FCL summary logic: query archive by range and optional order_name; return JSON response."""
    import json
    from datetime import timedelta

    logger.info(f"🕐 [FCL Summary] Query range (Dubai time): {start_with_buffer} to {end_with_buffer}")

    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            # ✅ Query 1: Get ALL records (no line_running filter) for FCL_2_520WE delta calculation
            # FCL_2_520WE is a cumulative counter that must include all records to calculate correct delta
            if order_name:
                cursor.execute("""
                    SELECT * FROM fcl_monitor_logs_archive
                    WHERE created_at >= %s
                      AND created_at <= %s
                      AND order_name = %s
                    ORDER BY created_at ASC
                """, (start_with_buffer, end_with_buffer, order_name))
            else:
                cursor.execute("""
                    SELECT * FROM fcl_monitor_logs_archive
                    WHERE created_at >= %s
                      AND created_at <= %s
                    ORDER BY created_at ASC
                """, (start_with_buffer, end_with_buffer))
            all_rows = cursor.fetchall()
            
            # ✅ Query 2: Get ALL records for production metrics (no line_running filter)
            if order_name:
                cursor.execute("""
                    SELECT * FROM fcl_monitor_logs_archive
                    WHERE created_at >= %s
                      AND created_at <= %s
                      AND order_name = %s
                    ORDER BY created_at ASC
                """, (start_with_buffer, end_with_buffer, order_name))
            else:
                cursor.execute("""
                    SELECT * FROM fcl_monitor_logs_archive
                    WHERE created_at >= %s
                      AND created_at <= %s
                    ORDER BY created_at ASC
                """, (start_with_buffer, end_with_buffer))
            rows = cursor.fetchall()

    # Check if we have records for FCL_2_520WE delta calculation
    if len(all_rows) < 1:
        logger.info("[FCL Summary] No records in range; returning 200 with empty summary")
        return jsonify({
            "status": "success",
            "summary": {"error": True, "message": "No records found in selected time range"}
        }), 200

    # ✅ Get FIRST and LAST records from ALL records for FCL_2_520WE delta calculation
    # ✅ FIX: Use records within EXACT time range (not buffer range) for accurate delta calculation
    # This ensures we calculate delta from the actual requested time period
    # Include records at exactly start and end times (e.g., 13:00:00 to 15:00:00)
    exact_rows = [r for r in all_rows if start_dubai <= r.get('created_at') <= end_dubai + timedelta(seconds=59)]
    
    if exact_rows:
        first_record = exact_rows[0]
        last_record = exact_rows[-1]
        logger.info(f"[FCL Summary] ✅ Using EXACT time range for delta: First: {first_record.get('created_at')}, Last: {last_record.get('created_at')}")
        logger.info(f"[FCL Summary] ✅ Found {len(exact_rows)} records in exact time range (out of {len(all_rows)} total with buffer)")
    else:
        # Fallback to buffer range if no exact matches (shouldn't happen normally)
        first_record = all_rows[0]
        last_record = all_rows[-1]
        logger.warning(f"[FCL Summary] ⚠️ No records in exact time range, using buffer range: First: {first_record.get('created_at')}, Last: {last_record.get('created_at')}")
    
    # If only 1 record, first = last
    
    # Check if we have production records
    record_count = len(rows)
    if record_count < 1:
        logger.warning(f"[FCL Summary] No production records (line_running=true) found, but {len(all_rows)} total records exist")

    # ✅ SUM produced weight from ALL archive records (each archive = hourly total)
    # Archive stores "how much was produced in that hour", so we SUM across multiple hours
    total_produced_weight = 0
    for record in rows:
        produced = float(record.get("produced_weight") or 0)
        total_produced_weight += produced
        logger.info(f"[FCL Summary] Adding produced_weight from record {record.get('id')}: {produced} kg")
    
    total_produced_weight = round(total_produced_weight, 3)
    logger.info(f"[FCL Summary] ✅ Total Produced Weight (summed): {total_produced_weight} kg")

    # ✅ SUM main receiver from ALL archive records (each archive = hourly total)
    # Archive stores "how much was received in that hour", so we SUM across multiple hours
    main_receiver_sum = 0
    for record in rows:
        receiver_val = float(record.get("receiver") or 0)
        main_receiver_sum += receiver_val
        logger.info(f"[FCL Summary] Adding receiver from record {record.get('id')}: {receiver_val} kg")
    
    main_receiver_sum = round(main_receiver_sum, 3)
    logger.info(f"[FCL Summary] ✅ Main Receiver Total (summed): {main_receiver_sum} kg")
    
    # ✅ SUM water_consumed from ALL archive records (each archive = hourly total liters)
    total_water_consumed = 0
    for record in rows:
        total_water_consumed += float(record.get("water_consumed") or 0)
    total_water_consumed = round(total_water_consumed, 3)
    logger.info(f"[FCL Summary] ✅ Total Water Consumed (summed): {total_water_consumed} L")
    
    # ✅ Calculate DELTA for FCL_2_520WE (cumulative counter from fcl_receivers)
    # FIX: Find maximum cumulative value from all records (not just last by timestamp)
    # This handles cases where the last record has invalid/decreasing cumulative values
    first_fcl_receivers = first_record.get("fcl_receivers")
    
    if isinstance(first_fcl_receivers, str):
        first_fcl_receivers = json.loads(first_fcl_receivers or "[]")
    
    # ✅ Handle None/empty cases (older records may not have fcl_receivers)
    if first_fcl_receivers is None:
        first_fcl_receivers = []
    
    # Calculate delta for FCL_2_520WE receivers by location
    # Data has actual weights in "Cumulative Counter" location
    output_bin_delta = 0  # Output Bin row: show delta (end - start) from Cumulative Counter
    cumulative_counter_last = 0  # Cumulative Counter row: show last value from Cumulative Counter
    
    # ✅ Define valid cumulative counter locations (old and new formats)
    cumulative_locations = ["Cumulative Counter", "FCL 2_520WE"]
    
    # ✅ Find first record's FCL_2_520WE cumulative value
    first_weight = 0
    first_rec = next((r for r in first_fcl_receivers 
                     if r.get("id") == "FCL_2_520WE" and r.get("location") in cumulative_locations), None)
    if first_rec:
        first_weight = float(first_rec.get("weight_kg") or first_rec.get("weight") or 0)
    
    # ✅ FIX: Find MAXIMUM cumulative value from ALL records (not just last by timestamp)
    # This handles cases where the last record has invalid/decreasing cumulative values
    max_weight = first_weight
    max_weight_record = first_record
    last_valid_weight = first_weight
    
    for record in all_rows:
        fcl_receivers = record.get("fcl_receivers")
        if isinstance(fcl_receivers, str):
            fcl_receivers = json.loads(fcl_receivers or "[]")
        if fcl_receivers is None:
            fcl_receivers = []
        
        for rec in fcl_receivers:
            if rec.get("id") == "FCL_2_520WE" and rec.get("location") in cumulative_locations:
                weight = float(rec.get("weight_kg") or rec.get("weight") or 0)
                if weight > max_weight:
                    max_weight = weight
                    max_weight_record = record
                # Track last valid (non-decreasing) weight
                if weight >= last_valid_weight:
                    last_valid_weight = weight
                break
    
    # ✅ Use maximum weight as the "last" value (most reliable)
    # If max_weight is same as first_weight, use last_valid_weight (chronologically last valid value)
    if max_weight > first_weight:
        cumulative_counter_last = max_weight
        output_bin_delta = max_weight - first_weight
        logger.info(f"[FCL Summary] ✅ Using MAXIMUM cumulative value: {first_weight} → {max_weight} (delta: {output_bin_delta} kg)")
        logger.info(f"[FCL Summary] ✅ Max value found in record at {max_weight_record.get('created_at')}")
    else:
        # If no increase found, use last valid weight (shouldn't happen in normal operation)
        cumulative_counter_last = last_valid_weight
        output_bin_delta = last_valid_weight - first_weight
        logger.warning(f"[FCL Summary] ⚠️ No cumulative increase found, using last valid: {first_weight} → {last_valid_weight} (delta: {output_bin_delta} kg)")
    
    # ✅ Validate delta is not negative (indicates data issue)
    if output_bin_delta < 0:
        logger.error(f"[FCL Summary] ❌ NEGATIVE DELTA DETECTED: {output_bin_delta} kg")
        logger.error(f"[FCL Summary] ❌ First weight: {first_weight} kg, Max/Last weight: {cumulative_counter_last} kg")
        logger.error(f"[FCL Summary] ❌ This indicates invalid cumulative counter data. Using summed receiver as fallback.")
        # Fallback to summed receiver if delta is negative
        if main_receiver_sum > 0:
            output_bin_delta = main_receiver_sum
            logger.warning(f"[FCL Summary] ⚠️ Using summed receiver ({main_receiver_sum} kg) as delta instead")
        else:
            output_bin_delta = 0
            logger.error(f"[FCL Summary] ❌ Cannot calculate valid delta. Setting to 0.")
    
    logger.info(f"[FCL Summary] ✅ Final Output Bin (delta): {output_bin_delta} kg")
    logger.info(f"[FCL Summary] ✅ Final Cumulative Counter (last): {cumulative_counter_last} kg")
    
    # ✅ Total receiver weight = Output Bin delta
    total_receiver_weight = output_bin_delta

    # ✅ SUM per_bin_weights from ALL archive records (each archive = hourly total)
    # Archive stores "how much was sent in that hour", so we SUM across multiple hours
    per_bin_weight_totals = {}
    all_bin_ids = set()
    
    for record in rows:
        bins = record.get("per_bin_weights")
        
        if isinstance(bins, str):
            try:
                bins = json.loads(bins or "{}")
            except:
                bins = {}
        
        if bins is None:
            bins = {}
        
        # Handle both dict format {"output_bin": 0.0} and array format [{"bin_id": "1", "total_weight": 0}]
        if isinstance(bins, dict):
            for bin_key, weight in bins.items():
                all_bin_ids.add(bin_key)
                if bin_key not in per_bin_weight_totals:
                    per_bin_weight_totals[bin_key] = 0
                per_bin_weight_totals[bin_key] += float(weight or 0)
        elif isinstance(bins, list):
            for bin_entry in bins:
                bin_id = bin_entry.get("bin_id")
                weight = float(bin_entry.get("total_weight") or 0)
                
                all_bin_ids.add(bin_id)
                
                if f"bin_{bin_id}" not in per_bin_weight_totals:
                    per_bin_weight_totals[f"bin_{bin_id}"] = 0
                
                per_bin_weight_totals[f"bin_{bin_id}"] += weight  # ✅ SUM all hours
    
    # Round all totals
    for bin_key in per_bin_weight_totals:
        per_bin_weight_totals[bin_key] = round(per_bin_weight_totals[bin_key], 3)
        logger.info(f"[FCL Summary] ✅ {bin_key} total (summed): {per_bin_weight_totals[bin_key]} kg")

    # Get setpoints from last record (current values)
    # Use last_record from filtered rows (production records) for current setpoints
    production_last_record = rows[-1] if rows else last_record
    average_flow_rate = float(production_last_record.get("flow_rate") or 0)
    average_moisture_offset = float(production_last_record.get("moisture_offset") or 0)
    average_moisture_setpoint = float(production_last_record.get("moisture_setpoint") or 0)
    cleaning_scale_bypass = production_last_record.get("cleaning_scale_bypass") # ✅ New field

    # ✅ Extract material names from active_sources for sender bins (aggregate from ALL records)
    material_summary = {}
    
    for record in rows:
        sources = record.get("active_sources")
        if isinstance(sources, str):
            sources = json.loads(sources or "[]")
        
        for source in sources:
            bin_id = source.get("bin_id")
            
            # Try multiple ways to get material name
            material_name = None
            
            # 1. Try nested material.material_name (DB Enrichment - Priority)
            if source.get("material") and isinstance(source.get("material"), dict):
                material_name = source["material"].get("material_name")
            
            # 2. Fallback to prd_name field (PLC)
            if not material_name and source.get("prd_name"):
                material_name = source.get("prd_name")
            
            # 3. Fallback to material_name field directly
            if not material_name and source.get("material_name"):
                material_name = source.get("material_name")
            
            # Store material name for this bin (if found)
            if material_name and bin_id and material_name != "N/A":
                material_summary[f"bin_{bin_id}"] = material_name
    
    logger.info(f"[FCL Summary] ✅ Extracted {len(material_summary)} material names from archive: {material_summary}")
    
    # ✅ For bins with "No Material" in the name, query the database for current material assignment
    bins_needing_update = [k for k, v in material_summary.items() if "No Material" in str(v)]
    if bins_needing_update:
        logger.info(f"[FCL Summary] Looking up current materials for bins with 'No Material': {bins_needing_update}")
        try:
            # Extract bin IDs from keys like "bin_213" -> 213
            bin_ids = [int(k.replace("bin_", "")) for k in bins_needing_update]
            
            # ✅ FCL bins use special mapping: 211->21A, 212->21B, 213->21C
            # Need to query by bin_code, not bin_id
            bin_codes = []
            for bid in bin_ids:
                if bid == 211:
                    bin_codes.append("21A")
                elif bid == 212:
                    bin_codes.append("21B")
                elif bid == 213:
                    bin_codes.append("21C")
                else:
                    bin_codes.append(str(bid))
            
            # Query bins table by bin_code with material join
            cursor.execute("""
                SELECT b.id, b.bin_code, b.bin_name, m.material_name 
                FROM bins b 
                LEFT JOIN materials m ON b.material_id = m.id 
                WHERE b.bin_code = ANY(%s)
            """, (bin_codes,))
            
            for row in cursor.fetchall():
                bin_code = row.get('bin_code')
                material_name = row.get('material_name')
                
                # Convert bin_code back to PLC bin_id for the key
                if bin_code == "21A":
                    plc_bin_id = 211
                elif bin_code == "21B":
                    plc_bin_id = 212
                elif bin_code == "21C":
                    plc_bin_id = 213
                else:
                    plc_bin_id = int(bin_code) if bin_code and str(bin_code).isdigit() else bin_code
                
                if material_name:
                    material_summary[f"bin_{plc_bin_id}"] = material_name
                    logger.info(f"[FCL Summary] ✅ Updated bin_{plc_bin_id} ({bin_code}): {material_name}")
                else:
                    # Friendly label when DB has no material assigned
                    material_summary[f"bin_{plc_bin_id}"] = f"Bin {bin_code}"
                    logger.info(f"[FCL Summary] ✅ No material for bin_{plc_bin_id} ({bin_code}): set to 'Bin {bin_code}'")
        except Exception as e:
            logger.warning(f"[FCL Summary] Error querying bin materials: {e}")
    
    # ✅ Ensure every bin in per_bin_weight_totals has an entry in material_summary (avoid "N/A")
    for bin_key in per_bin_weight_totals.keys():
        if bin_key in material_summary:
            continue
        try:
            bin_id_str = bin_key.replace("bin_", "")
            bin_id = int(bin_id_str) if bin_id_str.isdigit() else None
            if bin_id is None:
                material_summary[bin_key] = f"Bin {bin_id_str}"
                continue
            # FCL mapping: 211->21A, 212->21B, 213->21C
            if bin_id == 211:
                bin_code = "21A"
            elif bin_id == 212:
                bin_code = "21B"
            elif bin_id == 213:
                bin_code = "21C"
            else:
                bin_code = str(bin_id)
            cursor.execute("""
                SELECT b.bin_code, m.material_name
                FROM bins b
                LEFT JOIN materials m ON b.material_id = m.id
                WHERE b.bin_code = %s
            """, (bin_code,))
            row = cursor.fetchone()
            if row and row.get("material_name"):
                material_summary[bin_key] = row["material_name"]
                logger.info(f"[FCL Summary] ✅ Filled missing material_summary for {bin_key}: {row['material_name']}")
            else:
                material_summary[bin_key] = f"Bin {bin_code}"
                logger.info(f"[FCL Summary] ✅ Filled missing material_summary for {bin_key}: Bin {bin_code}")
        except Exception as e:
            logger.warning(f"[FCL Summary] Fallback for {bin_key}: {e}")
            material_summary[bin_key] = f"Bin {bin_key.replace('bin_', '')}"
    
    logger.info(f"[FCL Summary] Final material_summary: {material_summary}")

    # ✅ Extract receiver bin ID and material name from active_destination (Aggregate from ALL records)
    receiver_bin_id = None
    receiver_material_name = None
    
    for record in rows:
        dest = record.get("active_destination")
        if isinstance(dest, str):
            dest = json.loads(dest or "{}")
        
        if dest and isinstance(dest, dict):
            bid = dest.get("bin_id")
            mat_name = None
            if dest.get("material") and isinstance(dest.get("material"), dict):
                mat_name = dest["material"].get("material_name")
            elif dest.get("prd_name"):
                mat_name = dest.get("prd_name")
            # bin_id 0 is falsy in Python — handle explicitly so idle rows don't use `if bid:` only.
            if bid is not None and bid > 0:
                receiver_bin_id = bid
                if mat_name and mat_name != "N/A":
                    receiver_material_name = mat_name
                    if dest.get("material"):
                        break
            elif bid == 0 and receiver_bin_id is None:
                receiver_bin_id = 0
                receiver_material_name = None
    
    logger.info(f"[FCL Summary] Receiver: bin {receiver_bin_id}, material: {receiver_material_name}")

    tw_starts = [
        float(r["fcl_2_520we_at_order_start"])
        for r in rows
        if r.get("fcl_2_520we_at_order_start") is not None
    ]
    tw_ends = [
        float(r["fcl_2_520we_at_order_end"])
        for r in rows
        if r.get("fcl_2_520we_at_order_end") is not None
    ]
    fcl_520we_snap_start = round(min(tw_starts), 3) if tw_starts else None
    fcl_520we_snap_end = round(max(tw_ends), 3) if tw_ends else None

    # Prepare summary output
    summary = {
        "record_count": record_count,
        "average_flow_rate": round(average_flow_rate, 3),
        "average_moisture_offset": round(average_moisture_offset, 3),
        "average_moisture_setpoint": round(average_moisture_setpoint, 3),
        "cleaning_scale_bypass": cleaning_scale_bypass, # ✅ New field
        "total_water_consumed": total_water_consumed,  # ✅ Sum of water_consumed (L) from all archive records
        "total_produced_weight": round(output_bin_delta, 3),  # ✅ Produced = Output Bin delta
        "total_receiver_weight": round(total_receiver_weight, 3),  # Total receiver
        "main_receiver_weight": round(output_bin_delta, 3),  # ✅ Output Bin: delta (end - start)
        "fcl_2_520we_weight": round(cumulative_counter_last, 3),  # ✅ Cumulative Counter: last value
        "fcl_2_520we_last_value": round(cumulative_counter_last, 3), 
        "per_bin_weight_totals": per_bin_weight_totals,
        "material_summary": material_summary,
        "receiver_bin_id": receiver_bin_id,
        "receiver_material_name": receiver_material_name,
        "start_time": min([r.get("order_start_time") for r in rows if r.get("order_start_time")], default=first_record.get("created_at")),
        "end_time": max([r.get("order_end_time") for r in rows if r.get("order_end_time")], default=last_record.get("created_at")),
        "fcl_2_520we_at_order_start": fcl_520we_snap_start,
        "fcl_2_520we_at_order_end": fcl_520we_snap_end,
    }
    
    # ✅ Log final summary for debugging
    logger.info(f"[FCL Summary] 📊 Returning summary:")
    logger.info(f"  - per_bin_weight_totals (SUMMED): {len(per_bin_weight_totals)} bins, total: {sum(per_bin_weight_totals.values()):.1f} kg")
    logger.info(f"  - material_summary: {len(material_summary)} materials")
    logger.info(f"  - total_produced_weight (Output Bin delta): {summary['total_produced_weight']} kg")
    logger.info(f"  - main_receiver_weight (Output Bin delta): {summary['main_receiver_weight']} kg")
    logger.info(f"  - fcl_2_520we_weight (Cumulative Counter last): {summary['fcl_2_520we_weight']} kg")

    return jsonify({
        "status": "success",
        "summary": summary
    }), 200


@orders_bp.route('/fcl/archive/summary', methods=['GET'])
@handle_db_errors
def get_fcl_summary():
    """
    ✅ DELTA-BASED FCL Summary (for Reports). Requires start_date and end_date; optional order_name filter.
    """
    from flask import request, jsonify
    from datetime import datetime, timedelta

    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    order_name = request.args.get('order_name')

    if not start_date or not end_date:
        return jsonify({'status': 'error', 'message': 'Missing start_date or end_date'}), 400

    import pytz
    dubai_tz = pytz.timezone('Asia/Dubai')
    start_parsed = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
    end_parsed = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
    start_dubai = start_parsed.astimezone(dubai_tz).replace(tzinfo=None)
    end_dubai = end_parsed.astimezone(dubai_tz).replace(tzinfo=None)
    time_diff = end_dubai - start_dubai
    is_daily_or_longer = time_diff >= timedelta(hours=23, minutes=59)
    if is_daily_or_longer:
        start_with_buffer = start_dubai + timedelta(minutes=1)
    else:
        start_with_buffer = start_dubai
    # FCL hourly report: when end is on the hour (e.g. 14:00), include the full end hour (14:00:01 etc.)
    if end_dubai.minute == 0 and end_dubai.second == 0 and end_dubai.microsecond == 0:
        end_with_buffer = end_dubai.replace(minute=59, second=59, microsecond=999999)
    else:
        end_with_buffer = end_dubai
    return _run_fcl_summary(start_dubai, end_dubai, order_name, start_with_buffer, end_with_buffer)


@orders_bp.route('/analytics/fcl/summary', methods=['GET'])
@handle_db_errors
def get_fcl_analytics_summary():
    """
    Order Analytics: FCL summary by order_name. Requires order_name; optional start_date/end_date.
    If dates omitted, uses full order range (no buffers). Reports use archive/summary only.
    """
    from flask import request, jsonify
    from datetime import datetime, timedelta

    order_name = request.args.get('order_name')
    if not order_name:
        return jsonify({"status": "error", "message": "order_name is required"}), 400

    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if start_date and end_date:
        import pytz
        dubai_tz = pytz.timezone('Asia/Dubai')
        start_parsed = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        end_parsed = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        start_dubai = start_parsed.astimezone(dubai_tz).replace(tzinfo=None)
        end_dubai = end_parsed.astimezone(dubai_tz).replace(tzinfo=None)
        time_diff = end_dubai - start_dubai
        is_daily_or_longer = time_diff >= timedelta(hours=23, minutes=59)
        if is_daily_or_longer:
            start_with_buffer = start_dubai + timedelta(minutes=1)
        else:
            start_with_buffer = start_dubai
        end_with_buffer = end_dubai
    else:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT
                        COALESCE(MIN(order_start_time), MIN(created_at)),
                        COALESCE(MAX(order_end_time), MAX(created_at))
                    FROM fcl_monitor_logs_archive WHERE order_name = %s""",
                    (order_name,),
                )
                row = cur.fetchone()
        if not row or row[0] is None:
            return jsonify({
                "status": "success",
                "summary": {"error": True, "message": "No records found for this order"}
            }), 200
        start_dubai, end_dubai = row[0], row[1]
        start_with_buffer = start_dubai
        end_with_buffer = end_dubai
    return _run_fcl_summary(start_dubai, end_dubai, order_name, start_with_buffer, end_with_buffer)


def _run_ftra_summary(start_dubai, end_dubai, order_name=None):
    """Shared FTRA summary logic: query archive by range (and optional order_name); return JSON response."""
    import json
    from collections import defaultdict

    logger.info(f"🕐 [FTRA Summary] Querying range (Dubai time): {start_dubai} to {end_dubai}")

    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if order_name:
                cur.execute("""
                    SELECT *
                    FROM ftra_monitor_logs_archive
                    WHERE created_at >= %s
                      AND created_at <= %s
                      AND order_name = %s
                    ORDER BY created_at ASC
                """, (start_dubai, end_dubai, order_name))
            else:
                cur.execute("""
                    SELECT *
                    FROM ftra_monitor_logs_archive
                    WHERE created_at >= %s
                      AND created_at <= %s
                    ORDER BY created_at ASC
                """, (start_dubai, end_dubai))
            rows = cur.fetchall()

    record_count = len(rows)
    
    if record_count < 1:
        logger.info("📊 [FTRA Summary] No records in range; returning 200 with empty summary")
        return jsonify({
            "status": "success",
            "summary": {"error": True, "message": "No records found in selected time range"}
        }), 200

    # Get LAST record for current values (setpoints, etc.)
    last_record = rows[-1]
    
    logger.info(f"📊 [FTRA Summary] Found {record_count} records")

    # ✅ SUM produced_weight across all records (hourly totals)
    total_produced_weight = sum(float(r.get('produced_weight') or 0) for r in rows)
    logger.info(f"📊 [FTRA Summary] Produced weight (sum): {total_produced_weight} kg from {record_count} records")

    # ✅ SUM receiver_weight across all records
    total_receiver_weight = sum(float(r.get('receiver_weight') or 0) for r in rows)
    logger.info(f"📊 [FTRA Summary] Receiver weight (sum): {total_receiver_weight} kg")

    # ✅ SUM per_bin_weights across all records
    from collections import defaultdict
    bin_weight_totals = defaultdict(float)
    for r in rows:
        current_bins = r.get("per_bin_weights")
        if isinstance(current_bins, str):
            current_bins = json.loads(current_bins or "[]")
        
        if isinstance(current_bins, list):
            for b in current_bins:
                bin_id = b.get("bin_id")
                weight = float(b.get("total_weight") or 0)
                bin_weight_totals[f"bin_{bin_id}"] += weight
        elif isinstance(current_bins, dict):
            for bin_id, weight in current_bins.items():
                bin_weight_totals[f"bin_{bin_id}"] += float(weight or 0)
    
    # Convert to regular dict with rounded values
    bin_weight_totals = {k: round(v, 3) for k, v in bin_weight_totals.items()}
    logger.info(f"📊 [FTRA Summary] Per-bin totals (sum): {bin_weight_totals}")

    # ✅ Extract material names from active_sources
    material_summary = {}
    
    for record in rows:
        sources = record.get("active_sources")
        if isinstance(sources, str):
            sources = json.loads(sources or "[]")
        
        if sources:
            for source in sources:
                bin_id = source.get("bin_id")
                material_name = None
                
                material = source.get("material")
                if material and isinstance(material, dict):
                    material_name = material.get("material_name")
                else:
                    material_name = source.get("prd_name")
                
                if material_name and bin_id and material_name != "N/A":
                    material_summary[f"bin_{bin_id}"] = material_name
    
    logger.info(f"[FTRA Summary] Extracted {len(material_summary)} material names from active_sources")

    # Get setpoints from last record (average values from archive)
    # For FTRA we use the last record values for setpoints
    feeder_3_target = float(last_record.get('feeder_3_target') or 0)
    feeder_3_selected = last_record.get('feeder_3_selected') or False
    feeder_4_target = float(last_record.get('feeder_4_target') or 0)
    feeder_4_selected = last_record.get('feeder_4_selected') or False
    feeder_5_target = float(last_record.get('feeder_5_target') or 0)
    feeder_5_selected = last_record.get('feeder_5_selected') or False
    feeder_6_target = float(last_record.get('feeder_6_target') or 0)
    feeder_6_selected = last_record.get('feeder_6_selected') or False
    speed_discharge_50 = float(last_record.get('speed_discharge_50') or 0)
    speed_discharge_51_55 = float(last_record.get('speed_discharge_51_55') or 0)
    bag_collection = last_record.get('bag_collection') or False
    mixing_screw = last_record.get('mixing_screw') or False
    
    # Get receiver and sender bin IDs
    receiver_bin_id = last_record.get('receiver_bin_id')
    sender_1_bin_id = last_record.get('sender_1_bin_id')
    sender_2_bin_id = last_record.get('sender_2_bin_id')

    # Build receiver info
    receiver_weight = {}
    if receiver_bin_id:
        receiver_weight = {f"Receiver {receiver_bin_id}": round(total_receiver_weight, 3)}

    # Response
    return jsonify({
        "status": "success",
        "summary": {
            "record_count": record_count,
            "total_produced_weight": round(total_produced_weight, 3),
            "total_receiver_weight": round(total_receiver_weight, 3),
            "per_bin_weight_totals": bin_weight_totals,
            "material_summary": material_summary,
            "receiver_weight": receiver_weight,
            "receiver_bin_id": receiver_bin_id,
            "sender_1_bin_id": sender_1_bin_id,
            "sender_2_bin_id": sender_2_bin_id,
            # Setpoints
            "feeder_3_target": round(feeder_3_target, 3),
            "feeder_3_selected": feeder_3_selected,
            "feeder_4_target": round(feeder_4_target, 3),
            "feeder_4_selected": feeder_4_selected,
            "feeder_5_target": round(feeder_5_target, 3),
            "feeder_5_selected": feeder_5_selected,
            "feeder_6_target": round(feeder_6_target, 3),
            "feeder_6_selected": feeder_6_selected,
            "speed_discharge_50": round(speed_discharge_50, 3),
            "speed_discharge_51_55": round(speed_discharge_51_55, 3),
            "bag_collection": bag_collection,
            "mixing_screw": mixing_screw,
            "start_time": min([r.get("order_start_time") for r in rows if r.get("order_start_time")], default=rows[0].get("created_at")),
            "end_time": max([r.get("order_end_time") for r in rows if r.get("order_end_time")], default=last_record.get("created_at"))
        }
    }), 200


@orders_bp.route('/ftra/archive/summary', methods=['GET'])
@handle_db_errors
def get_ftra_archive_summary():
    """
    ✅ FTRA Summary (for Reports). Requires start_date and end_date; optional order_name filter.
    """
    from flask import request, jsonify
    from datetime import datetime, timedelta

    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    order_name = request.args.get('order_name')

    if not start_date or not end_date:
        return jsonify({"status": "error", "message": "start_date and end_date are required"}), 400

    import pytz
    dubai_tz = pytz.timezone('Asia/Dubai')
    start_parsed = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
    end_parsed = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
    start_dubai = start_parsed.astimezone(dubai_tz).replace(tzinfo=None) + timedelta(minutes=1)
    end_dubai = end_parsed.astimezone(dubai_tz).replace(tzinfo=None) + timedelta(minutes=5)
    return _run_ftra_summary(start_dubai, end_dubai, order_name)


@orders_bp.route('/analytics/ftra/summary', methods=['GET'])
@handle_db_errors
def get_ftra_analytics_summary():
    """
    Order Analytics: FTRA summary by order_name. Requires order_name; optional start_date/end_date.
    If dates omitted, uses full order range. Reports use archive/summary only.
    """
    from flask import request, jsonify
    from datetime import datetime, timedelta

    order_name = request.args.get('order_name')
    if not order_name:
        return jsonify({"status": "error", "message": "order_name is required"}), 400

    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if start_date and end_date:
        import pytz
        dubai_tz = pytz.timezone('Asia/Dubai')
        start_parsed = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        end_parsed = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        start_dubai = start_parsed.astimezone(dubai_tz).replace(tzinfo=None) + timedelta(minutes=1)
        end_dubai = end_parsed.astimezone(dubai_tz).replace(tzinfo=None) + timedelta(minutes=5)
    else:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT
                        COALESCE(MIN(order_start_time), MIN(created_at)),
                        COALESCE(MAX(order_end_time), MAX(created_at))
                    FROM ftra_monitor_logs_archive WHERE order_name = %s""",
                    (order_name,),
                )
                row = cur.fetchone()
        if not row or row[0] is None:
            return jsonify({
                "status": "success",
                "summary": {"error": True, "message": "No records found for this order"}
            }), 200
        start_dubai, end_dubai = row[0], row[1]

    return _run_ftra_summary(start_dubai, end_dubai, order_name)


@orders_bp.route('/archive/ftra/full', methods=['GET'])
@handle_db_errors
def get_ftra_full():
    """
    Get FTRA archive records.
    Optional: start_date, end_date (both = all in range); line_running (true/false).
    If start_date/end_date both missing: last 100 (DESC LIMIT 100, returned ASC).
    """
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    line_running_filter = request.args.get('line_running')
    line_running_bool = None
    if line_running_filter is not None:
        line_running_bool = line_running_filter.lower() in ('true', '1', 'yes')

    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            if start_date and end_date:
                import pytz
                start_parsed = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                end_parsed = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                dubai_tz = pytz.timezone('Asia/Dubai')
                start_dubai = start_parsed.astimezone(dubai_tz).replace(tzinfo=None)
                end_dubai = end_parsed.astimezone(dubai_tz).replace(tzinfo=None)
                if line_running_bool is not None:
                    cursor.execute("""
                        SELECT * FROM ftra_monitor_logs_archive
                        WHERE created_at >= %s AND created_at <= %s AND line_running = %s
                        ORDER BY created_at ASC
                    """, (start_dubai, end_dubai, line_running_bool))
                else:
                    cursor.execute("""
                        SELECT * FROM ftra_monitor_logs_archive
                        WHERE created_at >= %s AND created_at <= %s
                        ORDER BY created_at ASC
                    """, (start_dubai, end_dubai))
                rows = cursor.fetchall()
            else:
                if line_running_bool is not None:
                    cursor.execute("""
                        SELECT * FROM ftra_monitor_logs_archive
                        WHERE line_running = %s
                        ORDER BY created_at DESC
                        LIMIT 100
                    """, (line_running_bool,))
                else:
                    cursor.execute("""
                        SELECT * FROM ftra_monitor_logs_archive
                        ORDER BY created_at DESC
                        LIMIT 100
                    """)
                rows = cursor.fetchall()
                rows = list(reversed(rows))  # ASC for UI
            out = []
            for r in rows:
                row = dict(r)
                for dt_col in ('created_at', 'order_start_time', 'order_end_time'):
                    if row.get(dt_col) is not None and hasattr(row[dt_col], 'isoformat'):
                        row[dt_col] = row[dt_col].isoformat()
                out.append(row)
            return jsonify({'status': 'success', 'data': out}), 200

# =============================================================================
# Energy Monitoring Routes
# =============================================================================

@orders_bp.route('/store-energy-reading', methods=['POST'])
@handle_db_errors
def store_energy_reading():
    """Store energy readings from frontend"""
    data = request.get_json()
    
    # Validate required fields - support both old format (voltage_l1_l2) and new format (voltage_l1, voltage_l2, voltage_l3)
    has_individual_voltages = 'voltage_l1' in data and 'voltage_l2' in data and 'voltage_l3' in data
    has_legacy_voltage = 'voltage_l1_l2' in data
    
    if not has_individual_voltages and not has_legacy_voltage:
        return jsonify({'error': 'Missing voltage fields. Provide either voltage_l1_l2 (legacy) or voltage_l1, voltage_l2, voltage_l3'}), 400
    
    required = ['block_name', 'total_active_energy', 'total_reactive_energy',
                'total_apparent_energy', 'effective_power']
    
    for field in required:
        if field not in data:
            logger.warning(f"Missing field in energy reading: {field}")
            return jsonify({'error': f'Missing field: {field}'}), 400
    
    # Validate block_name
    valid_blocks = ['C2', 'M20', 'M21', 'M22', 'M23', 'M24']
    block_name = data['block_name']
    if block_name not in valid_blocks:
        logger.warning(f"Invalid block_name: {block_name}")
        return jsonify({'error': f'Invalid block_name. Must be one of: {", ".join(valid_blocks)}'}), 400
    
    # Validate and convert numeric values
    try:
        total_active_energy = float(data['total_active_energy'])
        total_reactive_energy = float(data['total_reactive_energy'])
        total_apparent_energy = float(data['total_apparent_energy'])
        effective_power = float(data['effective_power'])
        
        # Handle voltage values - new format preferred
        if has_individual_voltages:
            voltage_l1 = float(data['voltage_l1'])
            voltage_l2 = float(data['voltage_l2'])
            voltage_l3 = float(data['voltage_l3'])
            average_voltage = (voltage_l1 + voltage_l2 + voltage_l3) / 3.0
            voltage_l1_l2 = voltage_l1  # Keep for backward compatibility
        else:
            # Legacy format - use voltage_l1_l2 for all
            voltage_l1_l2 = float(data['voltage_l1_l2'])
            voltage_l1 = voltage_l1_l2
            voltage_l2 = voltage_l1_l2
            voltage_l3 = voltage_l1_l2
            average_voltage = voltage_l1_l2
        
    except (ValueError, TypeError) as e:
        logger.error(f"Invalid numeric value in energy reading: {e}")
        return jsonify({'error': 'Invalid numeric value in energy reading'}), 400
    
    # Store in database
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO energy_readings (
                        block_name, total_active_energy, total_reactive_energy,
                        total_apparent_energy, voltage_l1_l2, voltage_l1, voltage_l2, 
                        voltage_l3, average_voltage, effective_power, timestamp
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    RETURNING id
                """, (
                    block_name,
                    total_active_energy,
                    total_reactive_energy,
                    total_apparent_energy,
                    voltage_l1_l2,  # Keep for backward compatibility
                    voltage_l1,
                    voltage_l2,
                    voltage_l3,
                    average_voltage,
                    effective_power
                ))
                reading_id = cursor.fetchone()[0]
                conn.commit()
        
        logger.info(f"✅ Energy reading stored for {block_name} (ID: {reading_id})")
        return jsonify({'message': 'Stored successfully', 'id': reading_id}), 201
    
    except Exception as e:
        logger.error(f"❌ Error storing energy reading for {block_name}: {e}", exc_info=True)
        return jsonify({'error': 'Failed to store energy reading'}), 500


@orders_bp.route('/store-energy-readings-batch', methods=['POST'])
@handle_db_errors
def store_energy_readings_batch():
    """Store multiple energy readings at once (optional batch endpoint)"""
    data = request.get_json()
    
    if not isinstance(data, dict) or 'readings' not in data:
        return jsonify({'error': 'Missing "readings" array in request body'}), 400
    
    readings = data['readings']
    if not isinstance(readings, list):
        return jsonify({'error': '"readings" must be an array'}), 400
    
    valid_blocks = ['C2', 'M20', 'M21', 'M22', 'M23', 'M24']
    required_fields = ['block_name', 'total_active_energy', 'total_reactive_energy',
                      'total_apparent_energy', 'effective_power']
    
    stored_count = 0
    errors = []
    
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                for idx, reading in enumerate(readings):
                    try:
                        # Validate required fields
                        for field in required_fields:
                            if field not in reading:
                                errors.append(f"Reading {idx}: Missing field '{field}'")
                                continue
                        
                        # Validate block_name
                        block_name = reading['block_name']
                        if block_name not in valid_blocks:
                            errors.append(f"Reading {idx}: Invalid block_name '{block_name}'")
                            continue
                        
                        # Convert numeric values
                        try:
                            total_active_energy = float(reading['total_active_energy'])
                            total_reactive_energy = float(reading['total_reactive_energy'])
                            total_apparent_energy = float(reading['total_apparent_energy'])
                            effective_power = float(reading['effective_power'])
                            
                            # Handle voltage values - new format preferred
                            has_individual_voltages = 'voltage_l1' in reading and 'voltage_l2' in reading and 'voltage_l3' in reading
                            has_legacy_voltage = 'voltage_l1_l2' in reading
                            
                            if has_individual_voltages:
                                voltage_l1 = float(reading['voltage_l1'])
                                voltage_l2 = float(reading['voltage_l2'])
                                voltage_l3 = float(reading['voltage_l3'])
                                average_voltage = (voltage_l1 + voltage_l2 + voltage_l3) / 3.0
                                voltage_l1_l2 = voltage_l1  # Keep for backward compatibility
                            elif has_legacy_voltage:
                                voltage_l1_l2 = float(reading['voltage_l1_l2'])
                                voltage_l1 = voltage_l1_l2
                                voltage_l2 = voltage_l1_l2
                                voltage_l3 = voltage_l1_l2
                                average_voltage = voltage_l1_l2
                            else:
                                errors.append(f"Reading {idx}: Missing voltage fields")
                                continue
                        except (ValueError, TypeError):
                            errors.append(f"Reading {idx}: Invalid numeric values")
                            continue
                        
                        # Insert reading
                        cursor.execute("""
                            INSERT INTO energy_readings (
                                block_name, total_active_energy, total_reactive_energy,
                                total_apparent_energy, voltage_l1_l2, voltage_l1, voltage_l2, 
                                voltage_l3, average_voltage, effective_power, timestamp
                            )
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                        """, (
                            block_name,
                            total_active_energy,
                            total_reactive_energy,
                            total_apparent_energy,
                            voltage_l1_l2,  # Keep for backward compatibility
                            voltage_l1,
                            voltage_l2,
                            voltage_l3,
                            average_voltage,
                            effective_power
                        ))
                        stored_count += 1
                        
                    except Exception as e:
                        errors.append(f"Reading {idx}: {str(e)}")
                        logger.error(f"Error processing reading {idx}: {e}")
                
                conn.commit()
        
        logger.info(f"✅ Batch stored: {stored_count} readings, {len(errors)} errors")
        return jsonify({
            'message': f'Stored {stored_count} readings',
            'stored_count': stored_count,
            'error_count': len(errors),
            'errors': errors if errors else None
        }), 201
    
    except Exception as e:
        logger.error(f"❌ Error in batch store: {e}", exc_info=True)
        return jsonify({'error': 'Failed to store energy readings'}), 500


@orders_bp.route('/get-energy-history', methods=['GET'])
@handle_db_errors
def get_energy_history():
    """Get energy reading history"""
    block_name = request.args.get('block_name')
    limit = request.args.get('limit', 100, type=int)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    query = "SELECT * FROM energy_readings WHERE 1=1"
    params = []
    
    if block_name:
        query += " AND block_name = %s"
        params.append(block_name)
    
    if start_date:
        query += " AND timestamp >= %s"
        params.append(start_date)
    
    if end_date:
        query += " AND timestamp <= %s"
        params.append(end_date)
    
    query += " ORDER BY timestamp DESC LIMIT %s"
    params.append(limit)
    
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute(query, params)
            readings = cursor.fetchall()
            
            for reading in readings:
                if reading.get('timestamp'):
                    reading['timestamp'] = reading['timestamp'].isoformat()
    
    return jsonify({'status': 'success', 'count': len(readings), 'data': readings}), 200
