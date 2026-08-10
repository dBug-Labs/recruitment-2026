/**
 * lib/db.js
 *
 * MongoDB connection singleton.
 *
 * Uses a module-level cache in production and a global-object cache in
 * development so that Next.js hot-module replacement does not open a new
 * connection on every file save.
 *
 * Usage:
 *   import { getDb, getCollection } from '@/lib/db'
 *   const db  = await getDb()
 *   const col = await getCollection('applications')
 */

import { MongoClient, GridFSBucket } from 'mongodb'

const uri    = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB

if (!uri)    throw new Error('Missing env: MONGODB_URI')
if (!dbName) throw new Error('Missing env: MONGODB_DB')

/** @type {Promise<MongoClient>} */
let clientPromise

if (process.env.NODE_ENV === 'development') {
  // In development, preserve the client across HMR cycles via the global object.
  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri)
    global._mongoClientPromise = client.connect()
  }
  clientPromise = global._mongoClientPromise
} else {
  // In production, a module-level variable is fine because the module is
  // evaluated once per worker process.
  const client = new MongoClient(uri)
  clientPromise = client.connect()
}

/**
 * Returns the connected MongoClient.
 * @returns {Promise<MongoClient>}
 */
export async function getClient() {
  return clientPromise
}

/**
 * Returns the application database.
 * @returns {Promise<import('mongodb').Db>}
 */
export async function getDb() {
  const client = await clientPromise
  return client.db(dbName)
}

/**
 * Returns a named collection from the application database.
 * @param {string} name
 * @returns {Promise<import('mongodb').Collection>}
 */
export async function getCollection(name) {
  const db = await getDb()
  return db.collection(name)
}

/**
 * Returns a GridFSBucket for resume storage.
 * @param {string} [bucketName='resumes']
 * @returns {Promise<GridFSBucket>}
 */
export async function getGridFSBucket(bucketName = 'resumes') {
  const db = await getDb()
  return new GridFSBucket(db, { bucketName })
}

export { clientPromise }
