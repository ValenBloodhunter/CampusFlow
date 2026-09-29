# CampusFlow

CampusFlow uses live queue data and walking time to tell students whether they should leave now or wait before heading to a crowded campus service.

## Problem

Students often discover a campus queue only after they have already walked to the location. The problem is therefore not only waiting; it is the lack of useful queue information before committing to the trip.

## Our Solution

CampusFlow makes three campus queues visible remotely and turns the current queue plus walking time into a departure recommendation:

- `LEAVE NOW`
- `WAIT X MIN, THEN LEAVE`

## MVP

The prototype covers:

- Central Library
- Cafeteria
- Admin Office

A demo admin page changes queue counts live , the student page updates without refresh and asks the backend for a new recommendation.

## Tech Stack

- HTML, CSS, Vanilla JavaScript
- Python + Flask
- GitHub
- Vercel

## Google Services

- **Firebase Realtime Database** — core live queue state and realtime synchronization.
- **Google Maps Routes API** — preferred walking duration/distance source. The MVP transparently uses a fallback estimate if routing is unavailable.

## Run Locally

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py