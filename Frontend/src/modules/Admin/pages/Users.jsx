import { useState, useEffect, useCallback } from 'react'
import { Ban, Search, UserCheck, Eye, MessageSquare, ArrowLeft, User, Hash, MapPin, ShoppingBag, CreditCard, CheckCircle, Calendar, Send, XCircle, MoreVertical } from 'lucide-react'
import { DataTable } from '../components/DataTable'
import { StatusBadge } from '../components/StatusBadge'
import { Timeline } from '../components/Timeline'
import { useAdminState } from '../context/AdminContext'
import { useAdminApi } from '../hooks/useAdminApi'
import { useToast } from '../components/ToastNotification'
import { users as mockUsers } from '../services/adminData'
import { cn } from '../../../lib/cn'

const columns = [
  { Header: 'User', accessor: 'name' },
  { Header: 'User ID', accessor: 'id' },
  { Header: 'Region', accessor: 'region' },
  { Header: 'Linked Seller', accessor: 'sellerId' },
  { Header: 'Orders', accessor: 'orders' },
  { Header: 'Payments', accessor: 'payments' },
  { Header: 'Support Tickets', accessor: 'supportTickets' },
  { Header: 'Status', accessor: 'status' },
  { Header: 'Actions', accessor: 'actions' },
]

export function UsersPage({ subRoute = null, navigate }) {
  const { users: usersState } = useAdminState()
  const {
    getUsers,
    getUserDetails,
    blockUser,
    deactivateUser,
    activateUser,
    loading,
  } = useAdminApi()
  const { success, error: showError, warning: showWarning } = useToast()

  const [usersList, setUsersList] = useState([])
  const [allUsersList, setAllUsersList] = useState([])

  // View states (replacing modals with full-screen views)
  const [currentView, setCurrentView] = useState(null) // 'userDetail', 'supportTickets', 'blockUser', 'deactivateUser', 'activateUser'
  const [selectedUserForDetail, setSelectedUserForDetail] = useState(null)
  const [userDetails, setUserDetails] = useState(null)
  const [selectedUserForTickets, setSelectedUserForTickets] = useState(null)
  const [userTickets, setUserTickets] = useState([])
  const [selectedUserForAction, setSelectedUserForAction] = useState(null)
  const [blockReason, setBlockReason] = useState('')
  const [deactivateReason, setDeactivateReason] = useState('')
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [openActionsDropdown, setOpenActionsDropdown] = useState(null)

  // Fetch users
  const fetchUsers = useCallback(async () => {
    const result = await getUsers()
    if (result.data?.users) {
      setAllUsersList(result.data.users)
    } else {
      // Fallback to mock data
      setAllUsersList(mockUsers)
    }
  }, [getUsers])

  // Filter users based on subRoute
  useEffect(() => {
    // Current date for 2-month threshold calculation
    const twoMonthsAgo = new Date()
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)

    const isPending = (u) => u.name === 'Pending Registration'
    if (subRoute === 'active') {
      // Successful registration AND order made in last 2 months
      setUsersList(allUsersList.filter((u) => {
        if (isPending(u)) return false
        if (!u.lastOrderDate) return false
        return new Date(u.lastOrderDate) >= twoMonthsAgo
      }))
    } else if (subRoute === 'inactive') {
      // Successful registration AND (no orders OR last order > 2 months ago)
      setUsersList(allUsersList.filter((u) => {
        if (isPending(u)) return false
        if (!u.lastOrderDate) return true // No orders since registration
        return new Date(u.lastOrderDate) < twoMonthsAgo
      }))
    } else if (subRoute === 'incomplete') {
      // Accounts that haven't finished registration process
      setUsersList(allUsersList.filter((u) => isPending(u)))
    } else {
      setUsersList(allUsersList)
    }
  }, [subRoute, allUsersList])

  // Fetch user details
  const fetchUserDetails = useCallback(async (userId) => {
    const result = await getUserDetails(userId)
    if (result.data) {
      setUserDetails(result.data)
      return result.data
    }
    return null
  }, [getUserDetails])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Refresh when users are updated
  useEffect(() => {
    if (usersState.updated) {
      fetchUsers()
    }
  }, [usersState.updated, fetchUsers])

  const handleViewUserDetails = async (user) => {
    const originalUser = usersState.data?.users?.find((u) => u.id === user.id) || user
    setSelectedUserForDetail(originalUser)

    // Fetch detailed user data
    const details = await fetchUserDetails(user.id)
    if (details) {
      setUserDetails(details)
    }

    setCurrentView('userDetail')
  }

  const handleViewSupportTickets = async (user) => {
    const originalUser = usersState.data?.users?.find((u) => u.id === user.id) || user
    setSelectedUserForTickets(originalUser)

    // Fetch user details to get tickets
    const details = await fetchUserDetails(user.id)
    if (details && details.supportTickets) {
      setUserTickets(details.supportTickets)
    } else {
      // Mock tickets for demo
      setUserTickets([
        {
          id: 'TKT-001',
          ticketId: 'TKT-001',
          subject: 'Order delivery issue',
          description: 'Order #ORD-12345 was not delivered on time. Need assistance.',
          status: 'open',
          createdAt: '2024-01-15',
          conversation: [
            { from: 'User', message: 'Order #ORD-12345 was not delivered on time. Need assistance.', timestamp: '2024-01-15 10:00' },
            { from: 'Admin', message: 'We are looking into this issue. Will update you soon.', timestamp: '2024-01-15 11:30' },
          ],
        },
      ])
    }

    setSelectedTicket(null)
    setReplyText('')
    setCurrentView('supportTickets')
  }

  const handleBackToList = () => {
    setCurrentView(null)
    setSelectedUserForDetail(null)
    setUserDetails(null)
    setSelectedUserForTickets(null)
    setUserTickets([])
    setSelectedUserForAction(null)
    setBlockReason('')
    setDeactivateReason('')
    setSelectedTicket(null)
    setReplyText('')
    if (navigate) navigate('users')
  }

  const handleBlockUser = async (userId, reasonData) => {
    try {
      const result = await blockUser(userId, reasonData)
      if (result.data) {
        fetchUsers()
        setCurrentView(null)
        setSelectedUserForDetail(null)
        setSelectedUserForAction(null)
        setBlockReason('')
        success('User blocked successfully!', 3000)
      } else if (result.error) {
        const errorMessage = result.error.message || 'Failed to block user'
        showError(errorMessage, 5000)
      }
    } catch (error) {
      showError(error.message || 'Failed to block user', 5000)
    }
  }

  const handleDeactivateUser = async (userId, reasonData) => {
    try {
      const result = await deactivateUser(userId, reasonData)
      if (result.data) {
        fetchUsers()
        setCurrentView(null)
        setSelectedUserForDetail(null)
        setSelectedUserForAction(null)
        setDeactivateReason('')
        success('User deactivated successfully!', 3000)
      } else if (result.error) {
        const errorMessage = result.error.message || 'Failed to deactivate user'
        showError(errorMessage, 5000)
      }
    } catch (error) {
      showError(error.message || 'Failed to deactivate user', 5000)
    }
  }

  const handleActivateUser = async (userId) => {
    try {
      const result = await activateUser(userId)
      if (result.data) {
        fetchUsers()
        setCurrentView(null)
        setSelectedUserForDetail(null)
        setSelectedUserForAction(null)
        success('User activated successfully!', 3000)
      } else if (result.error) {
        const errorMessage = result.error.message || 'Failed to activate user'
        showError(errorMessage, 5000)
      }
    } catch (error) {
      showError(error.message || 'Failed to activate user', 5000)
    }
  }

  const handleResolveTicket = async (ticketId) => {
    // This would call an API to resolve the ticket
    console.log('Resolving ticket:', ticketId)
    // Update local state
    setUserTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === ticketId ? { ...ticket, status: 'resolved' } : ticket,
      ),
    )
  }

  const handleCloseTicket = async (ticketId) => {
    // This would call an API to close the ticket
    console.log('Closing ticket:', ticketId)
    // Update local state
    setUserTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === ticketId ? { ...ticket, status: 'closed' } : ticket,
      ),
    )
  }

  const handleReply = () => {
    if (replyText.trim() && selectedTicket) {
      // Handle reply - this would call an API
      console.log('Replying to ticket:', selectedTicket.id, replyText)
      setReplyText('')
    }
  }

  const tableColumns = columns.map((column) => {
    if (column.accessor === 'payments') {
      return {
        ...column,
        Cell: (row) => {
          const payments = row.payments || 'Unknown'
          const tone = payments === 'On Time' || payments === 'on_time' ? 'success' : 'warning'
          return <StatusBadge tone={tone}>{payments}</StatusBadge>
        },
      }
    }
    if (column.accessor === 'status') {
      return {
        ...column,
        Cell: (row) => {
          const status = row.status || 'Unknown'
          const tone = status === 'Active' || status === 'active' ? 'success' : status === 'Blocked' || status === 'blocked' ? 'neutral' : 'warning'
          return <StatusBadge tone={tone}>{status}</StatusBadge>
        },
      }
    }
    if (column.accessor === 'supportTickets') {
      return {
        ...column,
        Cell: (row) => {
          const count = row.supportTickets || 0
          return (
            <div className="flex items-center gap-2">
              <span className={count > 0 ? 'font-bold text-orange-600' : 'text-gray-600'}>
                {count}
              </span>
              {count > 0 && (
                <button
                  type="button"
                  onClick={() => handleViewSupportTickets(row)}
                  className="text-xs text-orange-600 hover:text-orange-700 font-semibold"
                >
                  View
                </button>
              )}
            </div>
          )
        },
      }
    }
    if (column.accessor === 'actions') {
      return {
        ...column,
        Cell: (row) => {
          const originalUser = usersState.data?.users?.find((u) => u.id === row.id) || row
          const isDropdownOpen = openActionsDropdown === row.id

          const actionItems = [
            {
              label: 'View details',
              icon: Eye,
              onClick: () => {
                handleViewUserDetails(originalUser)
                setOpenActionsDropdown(null)
              },
              className: 'text-gray-700 hover:bg-gray-50'
            }
          ]

          if (row.supportTickets > 0) {
            actionItems.push({
              label: 'View support tickets',
              icon: MessageSquare,
              onClick: () => {
                handleViewSupportTickets(originalUser)
                setOpenActionsDropdown(null)
              },
              className: 'text-orange-600 hover:bg-orange-50'
            })
          }

          return (
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenActionsDropdown(isDropdownOpen ? null : row.id)
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition-all hover:border-orange-500 hover:bg-orange-50 hover:text-orange-700"
                title="Actions"
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {isDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setOpenActionsDropdown(null)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-gray-200 bg-white shadow-lg py-1">
                    {actionItems.map((item, index) => {
                      const Icon = item.icon
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!item.disabled) {
                              item.onClick()
                            }
                          }}
                          disabled={item.disabled}
                          className={cn(
                            'w-full flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors',
                            item.className,
                            item.disabled && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )
        },
      }
    }
    return column
  })

  // Helper function for currency formatting
  const formatCurrency = (value) => {
    if (typeof value === 'string') {
      return value
    }
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(1)} L`
    }
    return `₹${value.toLocaleString('en-IN')}`
  }

  // If a full-screen view is active, render it instead of the main list
  if (currentView === 'userDetail' && (userDetails || selectedUserForDetail)) {
    const user = userDetails || selectedUserForDetail
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackToList}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition-all hover:border-orange-500 hover:bg-orange-50 hover:text-orange-700"
            title="Back to Users"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-2xl font-bold text-gray-900">User Details & Activity</h2>
        </div>
        <div className="space-y-6">
          {/* User Header */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{user.name}</h3>
                  <p className="text-sm text-gray-600">User ID: {user.id}</p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                    {user.region && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{user.region}</span>
                      </div>
                    )}
                    {user.phone && (
                      <div>
                        <span>{user.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <StatusBadge tone={user.status === 'Active' || user.status === 'active' ? 'success' : user.status === 'Blocked' || user.status === 'blocked' ? 'neutral' : 'warning'}>
                {user.status || 'Unknown'}
              </StatusBadge>
            </div>
          </div>

          {/* Linked IRA Partner */}
          {user.sellerId && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hash className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-xs text-blue-500">Linked IRA Partner ID</p>
                    <p className="text-sm font-bold text-blue-900">{user.sellerId}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Activity Summary */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <ShoppingBag className="h-4 w-4" />
                <span>Total Orders</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {user.orders || user.totalOrders || 0}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <CreditCard className="h-4 w-4" />
                <span>Payment Status</span>
              </div>
              <StatusBadge tone={user.payments === 'On Time' || user.payments === 'on_time' ? 'success' : 'warning'}>
                {user.payments || 'Unknown'}
              </StatusBadge>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <MessageSquare className="h-4 w-4" />
                <span>Support Tickets</span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-gray-900">
                  {user.supportTickets || user.openTickets || 0}
                </p>
                {user.supportTickets > 0 && (
                  <button
                    type="button"
                    onClick={() => handleViewSupportTickets(user)}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700"
                  >
                    View All
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Orders History */}
          {user.ordersHistory && user.ordersHistory.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-gray-600" />
                  <h4 className="text-sm font-bold text-gray-900">Order History</h4>
                </div>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {user.ordersHistory.map((order, index) => (
                  <div key={order.id || index} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{order.id || `Order #${index + 1}`}</p>
                        <p className="text-xs text-gray-600">{order.date || order.createdAt}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(order.value || order.amount || 0)}</p>
                        <StatusBadge tone={order.status === 'completed' ? 'success' : order.status === 'pending' ? 'warning' : 'neutral'}>
                          {order.status || 'Unknown'}
                        </StatusBadge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment History */}
          {user.paymentHistory && user.paymentHistory.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-gray-600" />
                <h4 className="text-sm font-bold text-gray-900">Payment History</h4>
              </div>
              <Timeline
                events={user.paymentHistory.map((payment, index) => ({
                  id: payment.id || `payment-${index}`,
                  title: payment.description || `Payment ${index + 1}`,
                  timestamp: payment.date || payment.timestamp || 'N/A',
                  description: formatCurrency(payment.amount || 0),
                  status: payment.status || 'completed',
                }))}
              />
            </div>
          )}

          {/* Support Tickets Summary */}
          {user.supportTickets > 0 && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-orange-900">Active Support Tickets</p>
                  <p className="text-xs text-orange-700">{user.supportTickets} ticket(s) require attention</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleViewSupportTickets(user)}
                  className="rounded-lg border border-orange-300 bg-white px-4 py-2 text-xs font-bold text-orange-700 transition-all hover:bg-orange-100"
                >
                  View Tickets
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleBackToList}
              className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50"
            >
              Close
            </button>
            <div className="flex gap-3">
              {user.status === 'Active' || user.status === 'active' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUserForAction(user)
                      setDeactivateReason('')
                      setCurrentView('deactivateUser')
                    }}
                    className="flex items-center gap-2 rounded-xl border border-orange-300 bg-white px-6 py-3 text-sm font-bold text-orange-600 transition-all hover:bg-orange-50"
                  >
                    <Ban className="h-4 w-4" />
                    Deactivate
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUserForAction(user)
                      setBlockReason('')
                      setCurrentView('blockUser')
                    }}
                    className="flex items-center gap-2 rounded-xl border border-red-300 bg-white px-6 py-3 text-sm font-bold text-red-600 transition-all hover:bg-red-50"
                  >
                    <Ban className="h-4 w-4" />
                    Block User
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUserForAction(user)
                    setCurrentView('activateUser')
                  }}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#017827] to-[#0a9937] px-6 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(1, 120, 39,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:shadow-[0_6px_20px_rgba(1, 120, 39,0.4),inset_0_1px_0_rgba(255,255,255,0.2)]"
                >
                  <CheckCircle className="h-4 w-4" />
                  Activate User
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (currentView === 'supportTickets' && selectedUserForTickets) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackToList}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition-all hover:border-orange-500 hover:bg-orange-50 hover:text-orange-700"
            title="Back to Users"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Support Tickets - {selectedUserForTickets.name || 'User'}</h2>
        </div>
        <div className="space-y-6">
          {!userTickets || userTickets.length === 0 ? (
            <div className="py-8 text-center rounded-2xl border border-gray-200 bg-white">
              <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-sm text-gray-600">No support tickets found for this user.</p>
            </div>
          ) : (
            <>
              {/* Tickets List */}
              <div className="space-y-3">
                {userTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className={cn(
                      'rounded-xl border p-4 transition-all cursor-pointer',
                      selectedTicket?.id === ticket.id
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50/50',
                    )}
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-gray-900">Ticket #{ticket.id || ticket.ticketId}</p>
                          <StatusBadge tone={ticket.status === 'resolved' ? 'success' : ticket.status === 'closed' ? 'neutral' : 'warning'}>
                            {ticket.status || 'Open'}
                          </StatusBadge>
                        </div>
                        <p className="mt-1 text-sm text-gray-700">{ticket.subject || ticket.title || 'No subject'}</p>
                        <p className="mt-1 text-xs text-gray-500">{ticket.description || ticket.message}</p>
                        {ticket.createdAt && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                            <Calendar className="h-3 w-3" />
                            <span>{ticket.createdAt}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Selected Ticket Details */}
              {selectedTicket && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-5">
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-gray-900">Ticket #{selectedTicket.id || selectedTicket.ticketId}</h4>
                      <StatusBadge tone={selectedTicket.status === 'resolved' ? 'success' : selectedTicket.status === 'closed' ? 'neutral' : 'warning'}>
                        {selectedTicket.status || 'Open'}
                      </StatusBadge>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{selectedTicket.subject || selectedTicket.title}</p>
                    <p className="mt-2 text-sm text-gray-700">{selectedTicket.description || selectedTicket.message}</p>
                  </div>

                  {/* Ticket Timeline */}
                  {selectedTicket.conversation && selectedTicket.conversation.length > 0 && (
                    <div className="mb-4">
                      <h5 className="mb-2 text-xs font-bold text-gray-500">Conversation</h5>
                      <Timeline
                        events={selectedTicket.conversation.map((msg, index) => ({
                          id: `msg-${index}`,
                          title: msg.from || 'User',
                          timestamp: msg.timestamp || msg.date || 'N/A',
                          description: msg.message || msg.text,
                          status: msg.from === 'Admin' ? 'completed' : 'pending',
                        }))}
                      />
                    </div>
                  )}

                  {/* Reply Section */}
                  {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' && (
                    <div className="space-y-3">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type your reply..."
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleReply}
                          disabled={!replyText.trim() || loading}
                          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-2 text-sm font-bold text-white shadow-[0_4px_15px_rgba(249,115,22,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:shadow-[0_6px_20px_rgba(249,115,22,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-50"
                        >
                          <Send className="h-4 w-4" />
                          Send Reply
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolveTicket(selectedTicket.id || selectedTicket.ticketId)}
                          disabled={loading}
                          className="flex items-center gap-2 rounded-lg border border-[rgba(1,120,39,0.4)] bg-white px-4 py-2 text-sm font-bold text-[#017827] transition-all hover:bg-[rgba(1,120,39,0.05)] disabled:opacity-50"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Resolve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCloseTicket(selectedTicket.id || selectedTicket.ticketId)}
                          disabled={loading}
                          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-600 transition-all hover:bg-gray-50 disabled:opacity-50"
                        >
                          <XCircle className="h-4 w-4" />
                          Close
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  if (currentView === 'blockUser' && selectedUserForAction) {
    const user = selectedUserForAction
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackToList}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition-all hover:border-orange-500 hover:bg-orange-50 hover:text-orange-700"
            title="Back to Users"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Block User</h2>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg">
                  <Ban className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{user.name}</h3>
                  <p className="text-sm text-gray-600">User ID: {user.id}</p>
                  {user.email && (
                    <p className="mt-1 text-xs text-gray-500">Email: {user.email}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-5">
              <label className="mb-2 block text-sm font-bold text-gray-700">Reason for Blocking</label>
              <textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Please provide a reason for blocking this user..."
                className="w-full rounded-lg border border-red-300 bg-white p-3 text-sm text-gray-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                rows={4}
              />
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleBackToList}
                className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleBlockUser(user.id || user._id, { reason: blockReason || undefined })}
                disabled={loading || !blockReason.trim()}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-6 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(239,68,68,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:shadow-[0_6px_20px_rgba(239,68,68,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-50"
              >
                <Ban className="h-4 w-4" />
                {loading ? 'Processing...' : 'Block User'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (currentView === 'deactivateUser' && selectedUserForAction) {
    const user = selectedUserForAction
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackToList}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition-all hover:border-orange-500 hover:bg-orange-50 hover:text-orange-700"
            title="Back to Users"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Deactivate User</h2>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg">
                  <Ban className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{user.name}</h3>
                  <p className="text-sm text-gray-600">User ID: {user.id}</p>
                  {user.email && (
                    <p className="mt-1 text-xs text-gray-500">Email: {user.email}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-5">
              <label className="mb-2 block text-sm font-bold text-gray-700">Reason for Deactivation</label>
              <textarea
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
                placeholder="Please provide a reason for deactivating this user..."
                className="w-full rounded-lg border border-orange-300 bg-white p-3 text-sm text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                rows={4}
              />
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleBackToList}
                className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeactivateUser(user.id || user._id, { reason: deactivateReason || undefined })}
                disabled={loading || !deactivateReason.trim()}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(249,115,22,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:shadow-[0_6px_20px_rgba(249,115,22,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-50"
              >
                <Ban className="h-4 w-4" />
                {loading ? 'Processing...' : 'Deactivate User'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (currentView === 'activateUser' && selectedUserForAction) {
    const user = selectedUserForAction
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackToList}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition-all hover:border-orange-500 hover:bg-orange-50 hover:text-orange-700"
            title="Back to Users"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Activate User</h2>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#017827] to-[#0a9937] text-white shadow-lg">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{user.name}</h3>
                  <p className="text-sm text-gray-600">User ID: {user.id}</p>
                  {user.email && (
                    <p className="mt-1 text-xs text-gray-500">Email: {user.email}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-[rgba(1,120,39,0.25)] bg-[rgba(1,120,39,0.04)] p-5">
              <p className="text-sm text-gray-700">
                Are you sure you want to activate this user? This action will restore their account access and allow them to use the platform.
              </p>
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleBackToList}
                className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleActivateUser(user.id || user._id)}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#017827] to-[#0a9937] px-6 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(1, 120, 39,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:shadow-[0_6px_20px_rgba(1, 120, 39,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                {loading ? 'Processing...' : 'Activate User'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const getPageTitle = () => {
    if (subRoute === 'active') return 'Active Users'
    if (subRoute === 'inactive') return 'Inactive Users'
    if (subRoute === 'incomplete') return 'Pending Registrations'
    return 'User Trust & Compliance'
  }

  const getPageDescription = () => {
    if (subRoute === 'active') return 'View and manage accounts with orders placed in the last 2 months.'
    if (subRoute === 'inactive') return 'Registered accounts with no orders since 2 months or never.'
    if (subRoute === 'incomplete') return 'Users who requested OTP but haven\'t completed their profile setup.'
    return 'Monitor orders, payments, and support escalations. Disable risky accounts with a single action.'
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Step 5 • User Management</p>
          <h2 className="text-2xl font-bold text-gray-900">{getPageTitle()}</h2>
          <p className="text-sm text-gray-600">
            {getPageDescription()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 font-semibold shadow-[0_2px_8px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.8)] transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 hover:shadow-[0_4px_12px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.8)]">
            <Search className="h-4 w-4" />
            Advanced Search
          </button>
          <button className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-2.5 text-sm font-bold text-white shadow-[0_4px_15px_rgba(249,115,22,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all duration-200 hover:shadow-[0_6px_20px_rgba(249,115,22,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] hover:scale-105 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]">
            <UserCheck className="h-4 w-4" />
            Verify Account
          </button>
        </div>
      </header>

      <DataTable
        columns={tableColumns}
        rows={usersList}
        emptyState="No user accounts found"
      />

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-3xl border border-orange-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
          <h3 className="text-lg font-bold text-orange-700">User Verification Workflow</h3>
          <p className="text-sm text-gray-600">
            Ensure every user is mapped to a seller, with payment visibility and support ticket insights.
          </p>
          <div className="space-y-3">
            {[
              {
                title: 'KYC Review',
                description: 'Auto fetch KYC docs and ensure mapping to seller IDs before activation.',
                status: 'Completed',
              },
              {
                title: 'Risk Scoring',
                description: 'Flag users with repeated payment delays or support escalations over SLA.',
                status: 'In Progress',
              },
              {
                title: 'Escalation Pipeline',
                description: 'Route flagged accounts to fraud prevention with timeline tracking.',
                status: 'Pending',
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-gray-200 bg-white p-4 hover:-translate-y-1 hover:shadow-[0_6px_20px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-900">{item.title}</p>
                  <StatusBadge tone={item.status === 'Completed' ? 'success' : item.status === 'In Progress' ? 'warning' : 'neutral'}>
                    {item.status}
                  </StatusBadge>
                </div>
                <p className="mt-2 text-xs text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4 rounded-3xl border border-red-200 bg-gradient-to-br from-red-50 to-red-100/50 p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
          <div className="flex items-center gap-3">
            <Ban className="h-5 w-5 text-red-600" />
            <div>
              <h3 className="text-lg font-bold text-gray-900">Suspicious Accounts</h3>
              <p className="text-sm text-red-700">
                Pattern-based alerts combining payment delays, refund rate, and support escalations.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              {
                user: 'USR-7841 • SLR-552',
                detail: 'Refund frequency above threshold. Review manual overrides and block if required.',
              },
              {
                user: 'USR-9922 • SLR-713',
                detail: 'Multiple support tickets unresolved. Investigate quality of service delivered.',
              },
              {
                user: 'USR-8841 • SLR-883',
                detail: 'Payment lapsed twice in 45 days. Credit risk flagged.',
              },
            ].map((item) => (
              <div key={item.user} className="rounded-2xl border border-red-200 bg-white px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.8)]">
                <p className="text-sm font-bold text-gray-900">{item.user}</p>
                <p className="text-xs text-red-700">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

