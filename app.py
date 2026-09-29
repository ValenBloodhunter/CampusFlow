from flask import Flask, render_template, jsonify

app = Flask(__name__, static_folder="public", static_url_path="")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/admin")
def admin():
    return render_template("admin.html")


@app.route("/api/health")
def health():
    return jsonify({"status": "base scaffold"})


if __name__ == "__main__":
    app.run(debug=True)