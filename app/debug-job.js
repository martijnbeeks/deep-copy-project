const jobId = '46529381-5bcd-4082-a09c-e4e6ec6d4e0b'

// Test the debug endpoint
fetch(`https://ai-copy-writing.vercel.app/api/debug-templates?jobId=${jobId}`)
  .then(response => response.json())
  .then(data => {
    console.log('🔍 Debug Template Data:', data)
  })
  .catch(error => {
    console.error('❌ Debug Error:', error)
  })
