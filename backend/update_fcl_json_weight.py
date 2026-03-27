"""
Update FCL JSON Weight Script
============================
Updates FCL_2_520WE weight value in the JSON column for a specific timestamp.

Usage:
------
    python update_fcl_json_weight.py --excel fcl_dec11_5am_to_dec12_5am.xlsx --date "2025-12-12 04:00:00" --weight 671619100
"""

import argparse
import pandas as pd
import json
from datetime import datetime

def update_fcl_json_weight(excel_file, target_date, new_weight, output_file=None):
    """
    Update FCL_2_520WE weight value in JSON column for a specific timestamp.
    
    Args:
        excel_file: Input Excel file path
        target_date: Target date/time to update (YYYY-MM-DD HH:MM:SS)
        new_weight: New weight value for FCL_2_520WE
        output_file: Output Excel file path (default: overwrites input file)
    """
    print(f"[INFO] Reading Excel file: {excel_file}")
    
    try:
        # Read Excel file
        df = pd.read_excel(excel_file)
        
        print(f"[INFO] Found {len(df)} records")
        
        # Find the JSON column (could be "FCL Receivers (JSON)" or similar)
        json_column = None
        for col in df.columns:
            if 'receivers' in col.lower() and 'json' in col.lower():
                json_column = col
                break
        
        if not json_column:
            print("[ERROR] Could not find FCL Receivers JSON column")
            print(f"[INFO] Available columns: {', '.join(df.columns)}")
            return
        
        print(f"[INFO] Found JSON column: {json_column}")
        
        # Parse target date
        try:
            if isinstance(target_date, str):
                target_dt = pd.to_datetime(target_date)
            else:
                target_dt = target_date
        except:
            print(f"[ERROR] Invalid date format: {target_date}")
            return
        
        # Find the row with matching timestamp
        if 'Created At' not in df.columns:
            print("[ERROR] 'Created At' column not found")
            return
        
        # Convert Created At to datetime for comparison
        df['Created At'] = pd.to_datetime(df['Created At'])
        
        # Find matching row (within 1 hour tolerance for archive records)
        matching_rows = df[df['Created At'].dt.floor('h') == target_dt.floor('h')]
        
        if len(matching_rows) == 0:
            print(f"[ERROR] No record found for date: {target_date}")
            print(f"[INFO] Available timestamps:")
            for idx, row in df.head(10).iterrows():
                print(f"  - {row['Created At']}")
            return
        
        if len(matching_rows) > 1:
            print(f"[WARNING] Multiple records found for {target_date}, updating all")
        
        updated_count = 0
        
        for idx, row in matching_rows.iterrows():
            # Get current JSON value
            json_str = row[json_column]
            
            if pd.isna(json_str) or json_str == '':
                print(f"[WARNING] Row {idx}: Empty JSON value, skipping")
                continue
            
            try:
                # Parse JSON
                fcl_receivers = json.loads(json_str) if isinstance(json_str, str) else json_str
                
                if not isinstance(fcl_receivers, list):
                    print(f"[WARNING] Row {idx}: JSON is not a list, skipping")
                    continue
                
                # Find and update FCL_2_520WE weight
                updated = False
                for rec in fcl_receivers:
                    rec_id = rec.get('id', '')
                    rec_name = rec.get('name', '')
                    
                    if rec_id == 'FCL_2_520WE' or rec_name == 'FCL 2_520WE':
                        old_weight = rec.get('weight', rec.get('weight_kg', 0))
                        rec['weight'] = float(new_weight)
                        # Also update weight_kg if it exists
                        if 'weight_kg' in rec:
                            rec['weight_kg'] = float(new_weight)
                        updated = True
                        print(f"[INFO] Row {idx} ({row['Created At']}): Updated FCL_2_520WE weight from {old_weight} to {new_weight}")
                        break
                
                if updated:
                    # Update the JSON column with new value
                    df.at[idx, json_column] = json.dumps(fcl_receivers)
                    updated_count += 1
                else:
                    print(f"[WARNING] Row {idx}: FCL_2_520WE not found in JSON")
                    
            except json.JSONDecodeError as e:
                print(f"[ERROR] Row {idx}: Invalid JSON - {e}")
                continue
        
        if updated_count == 0:
            print("[ERROR] No records were updated")
            return
        
        # Save updated Excel file
        output = output_file if output_file else excel_file
        df.to_excel(output, index=False, engine='openpyxl')
        
        print(f"[OK] Updated {updated_count} record(s)")
        print(f"[OK] Saved to: {output}")
        
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Update FCL JSON Weight in Excel')
    parser.add_argument('--excel', required=True,
                        help='Input Excel file path')
    parser.add_argument('--date', required=True,
                        help='Target date/time (YYYY-MM-DD HH:MM:SS, e.g., "2025-12-12 04:00:00")')
    parser.add_argument('--weight', type=float, required=True,
                        help='New weight value for FCL_2_520WE')
    parser.add_argument('--output', default=None,
                        help='Output Excel file path (default: overwrites input file)')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("  FCL JSON Weight Update Tool")
    print("=" * 60)
    print(f"  Input file: {args.excel}")
    print(f"  Target date: {args.date}")
    print(f"  New weight: {args.weight}")
    print(f"  Output file: {args.output or args.excel}")
    print("=" * 60)
    print()
    
    update_fcl_json_weight(args.excel, args.date, args.weight, args.output)
    
    print("\n" + "=" * 60)

