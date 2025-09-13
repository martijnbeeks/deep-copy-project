#!/usr/bin/env python3
"""
Helper script to install Playwright and its browser dependencies.
Run this after installing the package with: python install_playwright.py
"""

import subprocess
import sys

def install_playwright():
    """Install Playwright and its browser dependencies."""
    try:
        print("Installing Playwright...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "playwright"])
        
        print("Installing Playwright browser dependencies...")
        subprocess.check_call([sys.executable, "-m", "playwright", "install", "chromium"])
        
        print("Playwright installation completed successfully!")
        print("You can now use the PDF conversion functionality.")
        
    except subprocess.CalledProcessError as e:
        print(f"Error during installation: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    install_playwright()
