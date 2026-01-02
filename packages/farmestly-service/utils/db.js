const { MongoClient } = require('mongodb');

const MONGODB_IP = "127.0.0.1";
const G_DB__DATABASE_NAME = "appdb";

let mongo_client;
let mongo_root;

async function connect() {
	mongo_client = await MongoClient.connect(`mongodb://${MONGODB_IP}:27017`);
	mongo_root = mongo_client.db(G_DB__DATABASE_NAME);
	console.log('MongoDB connected');
	return mongo_client;
}

function getDb() {
	return mongo_root;
}

function getClient() {
	return mongo_client;
}

module.exports = { connect, getDb, getClient };