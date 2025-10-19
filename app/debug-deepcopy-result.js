const jobId = '46529381-5bcd-4082-a09c-e4e6ec6d4e0b'

// Test the DeepCopy result endpoint
fetch(`https://ai-copy-writing.vercel.app/api/jobs/${jobId}/result`)
  .then(response => response.json())
  .then(data => {
    console.log('🔍 DeepCopy Result Data:', JSON.stringify(data, null, 2))
  })
  .catch(error => {
    console.error('❌ DeepCopy Result Error:', error)
  })
