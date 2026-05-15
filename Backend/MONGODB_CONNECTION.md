# MongoDB Connection Configuration

## Connection Details

**MongoDB Atlas Cluster:** Cluster0  
**Connection String:**
```
mongodb+srv://yash007patidar_db_user:oTtWNuYdLNaGKMe6@cluster0.bjmsiqo.mongodb.net/?appName=Cluster0
```

**Username:** `yash007patidar_db_user`  
**Password:** `oTtWNuYdLNaGKMe6`

## Complete Connection String

For production use, add the database name to the connection string:

```
mongodb+srv://yash007patidar_db_user:oTtWNuYdLNaGKMe6@cluster0.bjmsiqo.mongodb.net/irasathi?retryWrites=true&w=majority&appName=Cluster0
```

Or use the shorter version:

```
mongodb+srv://yash007patidar_db_user:oTtWNuYdLNaGKMe6@cluster0.bjmsiqo.mongodb.net/irasathi?retryWrites=true&w=majority
```

## Environment Variable Setup

Create a `.env` file in the `Backend/` directory with:

```env
MONGO_URI=mongodb+srv://yash007patidar_db_user:oTtWNuYdLNaGKMe6@cluster0.bjmsiqo.mongodb.net/irasathi?retryWrites=true&w=majority
```

**Note:** Replace `irasathi` with your preferred database name, or use the default database by omitting the database name from the connection string.

## Connection String Breakdown

- **Protocol:** `mongodb+srv://` (MongoDB Atlas connection)
- **Username:** `yash007patidar_db_user`
- **Password:** `oTtWNuYdLNaGKMe6`
- **Host:** `cluster0.bjmsiqo.mongodb.net`
- **Database:** `irasathi` (add after host with `/`)
- **Parameters:**
  - `retryWrites=true` - Enable retryable writes
  - `w=majority` - Write concern (wait for majority of replicas)
  - `appName=Cluster0` - Application name (optional)

## Security Notes

1. **Never commit `.env` file** - It contains sensitive credentials
2. The `.env` file is already in `.gitignore`
3. For production, use environment variables or secure secret management
4. Consider using MongoDB Atlas IP Whitelist for additional security

## Testing Connection

Once `.env` is configured, test the connection:

```bash
cd Backend
npm run dev
```

You should see:
```
✅ MongoDB connected successfully
🚀 IRA SATHI Backend Server running on http://0.0.0.0:3000
```

## Troubleshooting

If connection fails:

1. **Check IP Whitelist:** Ensure your IP is whitelisted in MongoDB Atlas
   - Go to MongoDB Atlas → Network Access → Add IP Address
   - Or use `0.0.0.0/0` for development (NOT recommended for production)

2. **Check Credentials:** Verify username and password are correct

3. **Check Database Name:** Ensure the database name is correct or remove it to use default

4. **Check Connection String:** Ensure special characters in password are URL-encoded if needed

5. **Check Network:** Ensure you can reach MongoDB Atlas (firewall, VPN, etc.)

