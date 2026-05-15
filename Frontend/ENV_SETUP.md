# Frontend Environment Variables Setup

## Google Maps API Key Configuration

The Google Maps API key has been moved from the code to environment variables for security.

### Steps to Configure:

1. **Create a `.env` file** in the `FarmCommerce/Frontend` directory (if it doesn't exist)

3. **If you already have a `.env` file**, just add the `VITE_GOOGLE_MAPS_API_KEY` line to it.

### Important Notes:

- The `.env` file is already in `.gitignore` and will not be committed to version control
- The API key is now loaded dynamically from environment variables
- Make sure to restart your development server after creating/updating the `.env` file
- In production, set this environment variable in your hosting platform's environment settings

### Other Environment Variables:

If you need to configure the API base URL, you can also add:
```env
VITE_API_BASE_URL=http://localhost:3000/api
```


