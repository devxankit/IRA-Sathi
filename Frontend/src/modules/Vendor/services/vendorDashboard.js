export const vendorSnapshot = {
  welcome: {
    name: 'Suresh Patel',
    region: 'Surat, Gujarat',
    coverageKm: 20,
  },
  highlights: [
    { id: 'orders', label: 'Orders Today', value: 12, trend: '+3 vs yesterday' },
    { id: 'inventory', label: 'Urgent Stock', value: 4, trend: 'Items to restock' },
    { id: 'credit', label: 'Loan Balance', value: '₹12.4L', trend: 'Due in 8 days' },
  ],
  inventory: [
    {
      id: 'inv-1',
      name: 'NPK 24:24:0',
      stock: '1,240 kg',
      purchase: '₹1,050',
      selling: '₹1,380',
      status: 'Healthy',
    },
    {
      id: 'inv-2',
      name: 'Urea Blend',
      stock: '640 kg',
      purchase: '₹640',
      selling: '₹910',
      status: 'Low',
    },
    {
      id: 'inv-3',
      name: 'Micro Nutrients',
      stock: '210 kg',
      purchase: '₹720',
      selling: '₹980',
      status: 'Critical',
    },
  ],
  orders: [
    {
      id: 'ord-1',
      farmer: 'Anand Kumar',
      value: '₹48,600',
      status: 'Dispatched',
      payment: 'Advance received',
      next: 'Deliver before 24h SLA',
      statusUpdatedAt: '2024-12-18T09:15:00Z',
    },
    {
      id: 'ord-2',
      farmer: 'Mita Shah',
      value: '₹32,400',
      status: 'Awaiting',
      payment: 'Advance pending',
      next: 'Confirm availability',
      statusUpdatedAt: '2024-12-18T07:45:00Z',
    },
  ],
  credit: {
    limit: '₹35L',
    used: '₹22.6L',
    remaining: '₹12.4L',
    penalty: 'No penalty',
    due: '08 Dec 2025',
  },
  reports: [
    { label: 'Orders this week', value: '84', meta: '+12% growth' },
    { label: 'Earnings this month', value: '₹18.6L', meta: 'Processing ₹4.2L' },
    { label: 'Loan purchases', value: '₹9.4L', meta: 'Across 3 requests' },
    { label: 'Customer satisfaction', value: '4.7/5', meta: 'Based on 156 reviews' },
  ],
}

