const jobId = '46529381-5bcd-4082-a09c-e4e6ec6d4e0b'

// Test the job status endpoint
fetch(`https://ai-copy-writing.vercel.app/api/jobs/${jobId}/status`)
  .then(response => response.json())
  .then(data => {
    console.log('🔍 Job Status Data:', data)
  })
  .catch(error => {
    console.error('❌ Job Status Error:', error)
  })
