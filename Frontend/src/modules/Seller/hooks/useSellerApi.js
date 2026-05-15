/**
 * Custom hook for Seller API integration
 * Provides easy access to API functions with loading states and error handling
 */

import { useState, useCallback } from 'react'
import { useSellerDispatch } from '../context/SellerContext'
import * as sellerApi from '../services/sellerApi'

export function useSellerApi() {
  const dispatch = useSellerDispatch()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleApiCall = useCallback(
    async (apiFunction, successAction, errorMessage) => {
      setLoading(true)
      setError(null)
      try {
        const result = await apiFunction()
        // Extract data from response: { success: true, data: {...} } -> {...}
        const responseData = result.success ? result.data : null

        if (result.success && successAction && responseData) {
          dispatch(successAction(responseData))
        } else if (!result.success) {
          const errorMsg = result.error?.message || errorMessage || 'An error occurred'
          setError(errorMsg)
        }

        return { data: responseData, error: result.error || null }
      } catch (err) {
        const errorMsg = errorMessage || err.message || 'An error occurred'
        setError(errorMsg)
        return { data: null, error: { message: errorMsg } }
      } finally {
        setLoading(false)
      }
    },
    [dispatch],
  )

  // Dashboard APIs
  const fetchDashboardOverview = useCallback(async () => {
    return handleApiCall(
      sellerApi.getDashboardOverview,
      (data) => {
        // Transform backend response to frontend format
        const transformed = {
          totalReferrals: data.referrals?.total || 0,
          activeReferrals: data.referrals?.active || 0,
          currentMonthSales: data.sales?.currentMonth || 0,
          currentMonthOrders: data.sales?.orderCount || 0,
          averageOrderValue: data.sales?.averageOrderValue || 0,
          monthlyTarget: data.target?.monthlyTarget || 0,
          targetProgress: data.target?.progress || 0,
          targetAchieved: data.target?.achieved || 0,
          targetRemaining: data.target?.remaining || 0,
          status: data.target?.progress >= 100 ? 'Target Achieved' : data.target?.progress >= 50 ? 'On Track' : 'Needs Attention',
        }
        return { type: 'SET_DASHBOARD_OVERVIEW', payload: transformed }
      },
      'Failed to load dashboard overview',
    )
  }, [handleApiCall])

  const fetchWalletData = useCallback(async () => {
    return handleApiCall(
      sellerApi.getWalletBalance,
      (data) => {
        // Transform backend response to frontend format
        const transformed = {
          balance: data.wallet?.balance || 0,
          pending: data.wallet?.pending || 0,
          available: data.wallet?.available || (data.wallet?.balance || 0) - (data.wallet?.pending || 0),
          totalEarned: data.wallet?.balance || 0, // Total earned is same as balance for now
          recentCommissions: data.recentCommissions || [],
        }
        return { type: 'SET_WALLET_DATA', payload: transformed }
      },
      'Failed to load wallet data',
    )
  }, [handleApiCall])

  const fetchReferrals = useCallback(async (params = {}) => {
    return handleApiCall(
      () => sellerApi.getReferrals(params),
      (data) => {
        // Transform backend response to frontend format
        const transformed = {
          referrals: data.referrals || [],
          totalReferrals: data.totalReferrals || 0,
        }
        return { type: 'SET_REFERRALS_DATA', payload: transformed }
      },
      'Failed to load referrals',
    )
  }, [handleApiCall])

  const fetchPerformance = useCallback(async (params = {}) => {
    return handleApiCall(
      () => sellerApi.getPerformanceAnalytics(params),
      (data) => ({ type: 'SET_PERFORMANCE_DATA', payload: data }),
      'Failed to load performance data',
    )
  }, [handleApiCall])

  const fetchTargetIncentives = useCallback(async () => {
    return handleApiCall(
      sellerApi.getTargetIncentives,
      (data) => ({ type: 'SET_TARGET_INCENTIVES', payload: data?.incentives || data || [] }),
      'Failed to load target incentives',
    )
  }, [handleApiCall])

  // Profile APIs
  const updateProfile = useCallback(
    async (profileData) => {
      return handleApiCall(
        () => sellerApi.updateSellerProfile(profileData),
        (data) => ({ type: 'UPDATE_PROFILE', payload: data }),
        'Failed to update profile',
      )
    },
    [handleApiCall],
  )

  const changePassword = useCallback(
    async (passwordData) => {
      return handleApiCall(
        () => sellerApi.changePassword(passwordData),
        null,
        'Failed to change password',
      )
    },
    [handleApiCall],
  )

  const requestNameChange = useCallback(
    async (changeData) => {
      setLoading(true)
      setError(null)
      try {
        const result = await sellerApi.requestNameChange(changeData)
        // Backend returns { success: true, data: {...} } or { success: false, error: {...} }
        if (result.success && result.data) {
          return { data: result.data, error: null, success: true }
        } else {
          return { data: null, error: result.error || { message: 'Failed to submit name change request' }, success: false }
        }
      } catch (err) {
        const errorMsg = err.message || 'Failed to submit name change request'
        setError(errorMsg)
        return { data: null, error: { message: errorMsg }, success: false }
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const requestPhoneChange = useCallback(
    async (changeData) => {
      setLoading(true)
      setError(null)
      try {
        const result = await sellerApi.requestPhoneChange(changeData)
        // Backend returns { success: true, data: {...} } or { success: false, error: {...} }
        if (result && result.success && result.data) {
          return { data: result.data, error: null, success: true }
        } else if (result && result.error) {
          // Handle error response from API
          const errorMsg = result.error.message || 'Failed to submit phone change request'
          setError(errorMsg)
          return { data: null, error: result.error, success: false }
        } else {
          // Unexpected response structure
          const errorMsg = result?.message || 'Failed to submit phone change request'
          setError(errorMsg)
          return { data: null, error: { message: errorMsg }, success: false }
        }
      } catch (err) {
        const errorMsg = err.message || 'Failed to submit phone change request'
        setError(errorMsg)
        return { data: null, error: { message: errorMsg }, success: false }
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  // Wallet APIs
  const requestWithdrawal = useCallback(
    async (withdrawalData) => {
      return handleApiCall(
        () => sellerApi.requestWithdrawal(withdrawalData),
        null,
        'Failed to submit withdrawal request',
      )
    },
    [handleApiCall],
  )

  // Notification APIs
  const markNotificationRead = useCallback(
    async (notificationId) => {
      setLoading(true)
      setError(null)
      try {
        const result = await sellerApi.markNotificationRead(notificationId)
        if (result.success) {
          dispatch({ type: 'MARK_NOTIFICATION_READ', payload: { id: notificationId } })
          return { data: null, error: null }
        } else {
          const errorMsg = result.error?.message || 'Failed to mark notification as read'
          setError(errorMsg)
          return { data: null, error: result.error }
        }
      } catch (err) {
        const errorMsg = err.message || 'Failed to mark notification as read'
        setError(errorMsg)
        return { data: null, error: { message: errorMsg } }
      } finally {
        setLoading(false)
      }
    },
    [dispatch],
  )

  const markAllNotificationsRead = useCallback(async () => {
    return handleApiCall(
      sellerApi.markAllNotificationsRead,
      () => ({ type: 'MARK_ALL_NOTIFICATIONS_READ' }),
      'Failed to mark notifications as read',
    )
  }, [handleApiCall])

  // Support APIs
  const reportIssue = useCallback(
    async (reportData) => {
      return handleApiCall(
        () => sellerApi.reportIssue(reportData),
        null,
        'Failed to submit report',
      )
    },
    [handleApiCall],
  )

  const getSupportTickets = useCallback(
    async (params = {}) => {
      return handleApiCall(
        () => sellerApi.getSupportTickets(params),
        null,
        'Failed to fetch support tickets',
      )
    },
    [handleApiCall],
  )

  const getSupportTicketDetails = useCallback(
    async (ticketId) => {
      return handleApiCall(
        () => sellerApi.getSupportTicketDetails(ticketId),
        null,
        'Failed to fetch ticket details',
      )
    },
    [handleApiCall],
  )

  const sendSupportMessage = useCallback(
    async (ticketId, data) => {
      return handleApiCall(
        () => sellerApi.sendSupportMessage(ticketId, data),
        null,
        'Failed to send message',
      )
    },
    [handleApiCall],
  )

  // Commission APIs
  const getCommissionSummary = useCallback(async () => {
    return handleApiCall(
      sellerApi.getCommissionSummary,
      (data) => ({ type: 'SET_COMMISSION_SUMMARY', payload: data }),
      'Failed to fetch commission summary',
    )
  }, [handleApiCall])

  const getCommissionHistory = useCallback(
    async (params = {}) => {
      return handleApiCall(
        () => sellerApi.getCommissionHistory(params),
        null,
        'Failed to fetch commission history',
      )
    },
    [handleApiCall],
  )

  // Bank Account APIs
  const addBankAccount = useCallback(
    async (accountData) => {
      return handleApiCall(
        () => sellerApi.addBankAccount(accountData),
        null,
        'Failed to add bank account',
      )
    },
    [handleApiCall],
  )

  const getBankAccounts = useCallback(async () => {
    return handleApiCall(
      sellerApi.getBankAccounts,
      (data) => ({ type: 'SET_BANK_ACCOUNTS', payload: data.bankAccounts || [] }),
      'Failed to fetch bank accounts',
    )
  }, [handleApiCall])

  const updateBankAccount = useCallback(
    async (accountId, accountData) => {
      return handleApiCall(
        () => sellerApi.updateBankAccount(accountId, accountData),
        null,
        'Failed to update bank account',
      )
    },
    [handleApiCall],
  )

  const deleteBankAccount = useCallback(
    async (accountId) => {
      return handleApiCall(
        () => sellerApi.deleteBankAccount(accountId),
        null,
        'Failed to delete bank account',
      )
    },
    [handleApiCall],
  )

  return {
    loading,
    error,
    fetchDashboardOverview,
    fetchWalletData,
    fetchReferrals,
    fetchPerformance,
    fetchTargetIncentives,
    updateProfile,
    changePassword,
    requestNameChange,
    requestPhoneChange,
    requestWithdrawal,
    markNotificationRead,
    markAllNotificationsRead,
    reportIssue,
    getSupportTickets,
    getSupportTicketDetails,
    sendSupportMessage,
    getCommissionSummary,
    getCommissionHistory,
    addBankAccount,
    getBankAccounts,
    updateBankAccount,
    deleteBankAccount,
  }
}

