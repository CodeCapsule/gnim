console.log("Keys in process.env:");
Object.keys(process.env).forEach(key => {
  if (key.toLowerCase().includes("key") || key.toLowerCase().includes("secret") || key.toLowerCase().includes("token") || key.toLowerCase().includes("gemini") || key.toLowerCase().includes("google")) {
    console.log(`- ${key}: ${process.env[key] ? 'DEFINED (starts with ' + process.env[key].slice(0, 5) + '...)' : 'UNDEFINED'}`);
  }
});
