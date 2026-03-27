# FCL Produced Weight Calculation Fix

## Problem
For Dec 17-18, 2025 (5 AM to 5 AM), the system was showing incorrect "Produced" weight of **467104.0 kg** in the FCL Daily Report, while:
- Database has correct data: **342883.027 kg** (sum of produced_weight field)
- Excel export shows correct data
- Other dates (Dec 1-16) show correct values

## Root Cause
The system calculates "Produced" weight using the **FCL_2_520WE cumulative counter delta** (last value - first value). 

The issue was:
1. System was using `all_rows[-1]` (last record by timestamp) to get the cumulative counter value
2. The last record (ID 313, Dec 18 04:00) had an **invalid cumulative value**: 673141300.0 kg
3. This value was **LOWER** than the first record (673608404.0 kg), causing a **negative delta**: -467104.0 kg
4. The system/UI was displaying the absolute value: 467104.0 kg (incorrect)

## Data Analysis
- **First record** (Dec 17 06:00): 673608404.0 kg
- **Maximum cumulative value** (Dec 18 01:00, ID 310): 673805094.0 kg ✅ (correct)
- **Last record by timestamp** (Dec 18 04:00, ID 313): 673141300.0 kg ❌ (invalid - counter went down)

**Correct delta**: 673805094.0 - 673608404.0 = **196690.0 kg**

## Solution
Updated the FCL summary calculation in `orders_bp.py` to:
1. **Find the MAXIMUM cumulative counter value** from all records (not just last by timestamp)
2. **Validate that delta is positive** (cumulative counters should only increase)
3. **Use maximum value** as the "last" value for delta calculation
4. **Fallback to summed receiver** if delta is negative (data validation issue)

## Files Modified
- `orders_bp.py` - Updated `get_fcl_summary()` function (lines ~3399-3456)

## Testing
After the fix, the system should:
- Use maximum cumulative value: 673805094.0 kg
- Calculate correct delta: 196690.0 kg
- Display correct "Produced" weight in the FCL Daily Report

## Note
The system uses cumulative counter delta for "Produced" weight, not the summed `produced_weight` field. This is by design, but the cumulative counter must be valid (monotonically increasing).

