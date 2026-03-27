"""
Test script to verify FCL hourly report includes records correctly
"""

from datetime import datetime, timedelta

# Test case: 1 PM to 2 PM
start = datetime(2026, 1, 6, 13, 0, 0)
end = datetime(2026, 1, 6, 14, 0, 0)

# Calculate time difference
time_diff = end - start
is_hourly_report = time_diff <= timedelta(hours=1, minutes=1)

# Apply buffer logic
if is_hourly_report:
    start_with_buffer = start
    print(f"[OK] Hourly report detected ({time_diff})")
    print(f"   Using exact start time (no buffer)")
else:
    start_with_buffer = start + timedelta(minutes=1)
    print(f"[OK] Daily/Weekly/Monthly report detected ({time_diff})")
    print(f"   Using +1 minute buffer")

end_with_buffer = end

print(f"\nQuery range: {start_with_buffer} to {end_with_buffer}")

# Test record at 13:00:01
test_record = datetime(2026, 1, 6, 13, 0, 1, 584707)
is_included = start_with_buffer <= test_record <= end_with_buffer

print(f"\nRecord at 13:00:01.584707:")
print(f"   Included in query: {is_included}")
print(f"   [{'PASS' if is_included else 'FAIL'}]")

