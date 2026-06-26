const axios = require('axios');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

async function testMultiple() {
  const url = 'https://www.ghanamma.com/wp-json/wp/v2/categories?per_page=100';
  
  for (let i = 1; i <= 5; i++) {
    console.log(`\n--- Request #${i} ---`);
    const start = Date.now();
    try {
      const res = await axios.get(url, {
        headers: {
          'User-Agent': USER_AGENT
        },
        timeout: 10000
      });
      const duration = Date.now() - start;
      console.log(`Success! Status: ${res.status}, Time: ${duration}ms, Categories: ${res.data.length}`);
    } catch (err) {
      const duration = Date.now() - start;
      console.error(`Failed! Time: ${duration}ms`);
      if (err.response) {
        console.error(`- Status: ${err.response.status}`);
      } else {
        console.error(`- Message: ${err.message}`);
      }
    }
    // Wait 500ms between requests
    await new Promise(r => setTimeout(r, 500));
  }
}

testMultiple();
