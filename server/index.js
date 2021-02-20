const keys = require('./keys');

// Express App Setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Postgres Client Setup
const { Pool } = require('pg');
const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort,
});

pgClient.on('connect', () => {
  console.log("pgClient.on('connect')"); 
  
  pgClient
    .query('CREATE TABLE IF NOT EXISTS values (number integer)')
	.then(() => console.log("Table created"))
    .catch((err) => console.log(err));
	
  console.log("pgClient.on('connect') finished"); 
});

// Redis Client Setup
const redis = require('redis');
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000,
});
const redisPublisher = redisClient.duplicate();

// Express route handlers

app.get('/', (req, res) => {
	console.log("Route /");
  res.send('Hi');
});

app.get('/values/all', async (req, res) => {
  console.log("Route /values/all");

  const values = await pgClient.query('SELECT * FROM values');

  res.send(values ? values.rows : "No values");
});

app.get('/values/current', async (req, res) => {
  redisClient.hgetall('values', (err, values) => {
    res.send(values);
  });
});

app.post('/values', async (req, res) => {
  console.log("Route /values");
  const index = req.body.index;

  if (parseInt(index) > 40) {
    return res.status(422).send('Index too high');
  }

  redisClient.hset('values', index, 'Nothing yet!');
  redisPublisher.publish('insert', index);
  pgClient.query('INSERT INTO values(number) VALUES($1)', [index])
	.then(() => console.log("values INSERTED"))
    .catch((err) => console.log(err));

  res.send({ working: true });
});

app.listen(5000, (err) => {
  console.log('Listening');
});
