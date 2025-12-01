// Script to delete the 1000 oldest items from the analytics collection

const API_KEY = 'AIzaSyAWhfwD5GSsgZ8qzNyvn2kmNn3yVu0QaHY'
const PROJECT_ID = 'ag-web-ab4d9'

async function authenticate() {
  const authRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'guest@aaltogamers.fi',
        password: 'aaltogamerpassword',
        returnSecureToken: true,
      }),
    }
  )
  const authData = await authRes.json()
  return authData.idToken
}

async function getOldestDocuments(idToken, limit) {
  console.log(`Fetching ${limit} oldest analytics documents...`)

  const queryUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`
  const queryRes = await fetch(queryUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'analytics' }],
        orderBy: [{ field: { fieldPath: 'timestamp' }, direction: 'ASCENDING' }],
        limit: limit,
      },
    }),
  })

  const queryData = await queryRes.json()
  return queryData.filter((item) => item.document).map((item) => item.document.name)
}

async function batchDelete(idToken, docNames) {
  const writes = docNames.map((docName) => ({
    delete: docName,
  }))

  const batchUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`
  await fetch(batchUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ writes }),
  })
}

async function deleteOldestAnalytics() {
  console.log('Authenticating...')
  const idToken = await authenticate()
  console.log('Authenticated successfully')

  const docNames = await getOldestDocuments(idToken, 20000)
  console.log(`Found ${docNames.length} documents to delete`)

  // Firestore batch limit is 500 operations
  const BATCH_SIZE = 500
  let deleted = 0

  for (let i = 0; i < docNames.length; i += BATCH_SIZE) {
    const batch = docNames.slice(i, i + BATCH_SIZE)
    try {
      await batchDelete(idToken, batch)
      deleted += batch.length
      console.log(`Deleted ${deleted}/${docNames.length} documents...`)
    } catch (error) {
      console.error(`Error deleting batch:`, error.message)
    }
  }

  console.log(`Deletion complete! Deleted ${deleted} documents.`)
}

deleteOldestAnalytics().catch(console.error)
