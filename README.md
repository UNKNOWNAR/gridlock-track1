# BTP Enforcement Intelligence

Internal parking violation analysis tool for Bangalore Traffic Police.

## Setup

1. Place the violations CSV file at `data/violations.csv`

2. Get a MapmyIndia API key from https://www.mapmyindia.com/api — sign up, create a project, and copy the REST API key

3. Install dependencies:

        pip install -r requirements.txt

4. Create your environment file:

        cp .env.example .env

   Open `.env` and replace `your_key_here` with your actual MapmyIndia API key

5. Run the app:

        streamlit run app.py
