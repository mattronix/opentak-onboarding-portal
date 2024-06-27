FROM python:3.9.5-slim-buster

ADD . /app
WORKDIR /app
RUN pip install -r requirements.txt
EXPOSE 5000

CMD ["gunicorn", "-w", "1", "-t", "50", "app:app", "-b", "0.0.0.0:5000"]
