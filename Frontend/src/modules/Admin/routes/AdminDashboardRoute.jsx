import { useMemo, useState, useCallback } from 'react'
import { AdminProvider } from '../context/AdminContext'
import { ToastProvider } from '../components/ToastNotification'
import { AdminLayout } from '../components/AdminLayout'
import { Sidebar } from '../components/Sidebar'
import { DashboardPage } from '../pages/Dashboard'
import { ProductsPage } from '../pages/Products'
import { VendorsPage } from '../pages/Vendors'
import { SellersPage } from '../pages/Sellers'
import { UsersPage } from '../pages/Users'
import { OrdersPage } from '../pages/Orders'
import { FinancePage } from '../pages/Finance'
import { OperationsPage } from '../pages/Operations'
import { AnalyticsPage } from '../pages/Analytics'
import { VendorWithdrawalsPage } from '../pages/VendorWithdrawals'
import { SellerWithdrawalsPage } from '../pages/SellerWithdrawals'
import { PaymentHistoryPage } from '../pages/PaymentHistory'
import { OffersPage } from '../pages/Offers'
import { RepaymentsPage } from '../pages/Repayments'
import { ReviewsPage } from '../pages/Reviews'
import TasksPage from '../pages/Tasks'
import { PushNotificationsPage } from '../pages/PushNotifications'
import { SupportPage } from '../pages/Support'

const routeConfig = [
  { id: 'dashboard', element: DashboardPage },
  { id: 'products', element: ProductsPage },
  { id: 'vendors', element: VendorsPage },
  { id: 'sellers', element: SellersPage },
  { id: 'users', element: UsersPage },
  { id: 'orders', element: OrdersPage },
  { id: 'finance', element: FinancePage },
  { id: 'operations', element: OperationsPage },
  { id: 'analytics', element: AnalyticsPage },
  { id: 'vendor-withdrawals', element: VendorWithdrawalsPage },
  { id: 'seller-withdrawals', element: SellerWithdrawalsPage },
  { id: 'payment-history', element: PaymentHistoryPage },
  { id: 'offers', element: OffersPage },
  { id: 'repayments', element: RepaymentsPage },
  { id: 'reviews', element: ReviewsPage },
  { id: 'tasks', element: TasksPage },
  { id: 'push-notifications', element: PushNotificationsPage },
  { id: 'support', element: SupportPage },
]

function AdminDashboardContent({ activeRoute, setActiveRoute, onExit }) {
  const { pageId, subRoute } = useMemo(() => {
    // Parse route like 'products/add' into pageId='products' and subRoute='add'
    const parts = activeRoute.split('/')
    return {
      pageId: parts[0],
      subRoute: parts.slice(1).join('/') || null,
    }
  }, [activeRoute])

  const ActivePageComponent = useMemo(() => {
    const match = routeConfig.find((route) => route.id === pageId)
    return match?.element ?? DashboardPage
  }, [pageId])

  const navigate = useCallback((route) => {
    setActiveRoute(route)
  }, [setActiveRoute])

  return (
    <AdminLayout
      sidebar={(props) => <Sidebar active={activeRoute} onNavigate={setActiveRoute} {...props} />}
      onExit={onExit}
    >
      <ActivePageComponent subRoute={subRoute} navigate={navigate} />
    </AdminLayout>
  )
}

export function AdminDashboardRoute({ onExit }) {
  const [activeRoute, setActiveRoute] = useState('dashboard')

  return (
    <AdminProvider>
      <ToastProvider>
        <AdminDashboardContent
          activeRoute={activeRoute}
          setActiveRoute={setActiveRoute}
          onExit={onExit}
        />
      </ToastProvider>
    </AdminProvider>
  )
}

