"""
tests/conftest.py — Shared test configuration.
"""

import sys
import os

# Ensure the API root is in the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Force SQLite for tests
os.environ["DATABASE_URL"] = ""
