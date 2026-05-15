import { useState, useEffect, useCallback } from 'react'
import { Building2, CreditCard, MapPin, ShieldAlert, Edit2, Eye, Package, Ban, Unlock, CheckCircle, XCircle, ArrowLeft, Calendar, FileText, ExternalLink, Search, MoreVertical } from 'lucide-react'
import { DataTable } from '../components/DataTable'
import { StatusBadge } from '../components/StatusBadge'
import { Timeline } from '../components/Timeline'
import { VendorMap } from '../components/VendorMap'
import { CreditPolicyForm } from '../components/CreditPolicyForm'
import { VendorEditForm } from '../components/VendorEditForm'
import { useAdminState } from '../context/AdminContext'
import { useAdminApi } from '../hooks/useAdminApi'
import { useToast } from '../components/ToastNotification'

import { cn } from '../../../lib/cn'

const EARTH_RADIUS_KM = 6371
const COVERAGE_RADIUS_KM = 20

const calculateDistanceKm = (pointA, pointB) => {
  if (!pointA?.lat || !pointA?.lng || !pointB?.lat || !pointB?.lng) {
    return Infinity
  }
  const toRad = (value) => (value * Math.PI) / 180
  const dLat = toRad(pointB.lat - pointA.lat)
  const dLng = toRad(pointB.lng - pointA.lng)
  const lat1 = toRad(pointA.lat)
  const lat2 = toRad(pointB.lat)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

const computeCoverageReport = (vendors = []) => {
  const geoVendors = vendors.filter((vendor) => vendor.location?.lat && vendor.location?.lng)
  const conflicts = []
  const flagged = new Set()

  for (let i = 0; i < geoVendors.length; i += 1) {
    for (let j = i + 1; j < geoVendors.length; j += 1) {
      const vendorA = geoVendors[i]
      const vendorB = geoVendors[j]
      const distanceKm = calculateDistanceKm(vendorA.location, vendorB.location)
      if (distanceKm < COVERAGE_RADIUS_KM) {
        flagged.add(vendorA.id)
        flagged.add(vendorB.id)
        conflicts.push({
          id: `${vendorA.id}-${vendorB.id}`,
          vendorA,
          vendorB,
          distanceKm: Number(distanceKm.toFixed(2)),
          overlapKm: Number(Math.max(COVERAGE_RADIUS_KM - distanceKm, 0).toFixed(2)),
        })
      }
    }
  }

  return {
    total: geoVendors.length,
    coverageRadius: COVERAGE_RADIUS_KM,
    conflicts,
    flaggedVendors: Array.from(flagged),
    compliantCount: Math.max(geoVendors.length - flagged.size, 0),
  }
}

const columns = [
  { Header: 'Vendor', accessor: 'name' },
  { Header: 'Region', accessor: 'region' },
  { Header: 'Coverage', accessor: 'coverageRadius' },
  { Header: 'Credit Limit', accessor: 'creditLimit' },
  { Header: 'Repayment', accessor: 'repayment' },
  { Header: 'Penalty Rate', accessor: 'penalty' },
  { Header: 'Status', accessor: 'status' },
  { Header: 'Outstanding Dues', accessor: 'dues' },
  { Header: 'Actions', accessor: 'actions' },
]

export function VendorsPage({ subRoute = null, navigate }) {
  const { vendors: vendorsState } = useAdminState()
  const {
    getVendors,
    approveVendor,
    rejectVendor,
    banVendor,
    unbanVendor,
    updateVendorCreditPolicy,
    updateVendor,
    getVendorPurchaseRequests,
    approveVendorPurchase,
    rejectVendorPurchase,
    loading,
  } = useAdminApi()
  const { success, error: showError, warning: showWarning } = useToast()

  const [vendorsList, setVendorsList] = useState([])
  const [allVendorsList, setAllVendorsList] = useState([])
  const [rawVendors, setRawVendors] = useState([])
  const [purchaseRequests, setPurchaseRequests] = useState([])
  const [coverageReport, setCoverageReport] = useState(null)

  // View states (replacing modals with full-screen views)
  const [currentView, setCurrentView] = useState(null) // 'creditPolicy', 'vendorDetail', 'vendorMap', 'purchaseRequest', 'approveVendor', 'rejectVendor', 'banVendor', 'unbanVendor', 'editVendor'
  const [selectedVendorForPolicy, setSelectedVendorForPolicy] = useState(null)
  const [selectedPurchaseRequest, setSelectedPurchaseRequest] = useState(null)
  const [selectedVendorForDetail, setSelectedVendorForDetail] = useState(null)
  const [selectedVendorForMap, setSelectedVendorForMap] = useState(null)
  const [selectedVendorForAction, setSelectedVendorForAction] = useState(null)
  const [selectedVendorForEdit, setSelectedVendorForEdit] = useState(null)
  const [actionData, setActionData] = useState(null) // For storing form data for actions like reject/ban
  const [rejectReason, setRejectReason] = useState('')
  const [banType, setBanType] = useState('temporary')
  const [banReason, setBanReason] = useState('')
  const [revocationReason, setRevocationReason] = useState('')
  const [purchaseRejectReason, setPurchaseRejectReason] = useState(null) // null = not showing, '' = showing input
  const [searchQuery, setSearchQuery] = useState('')
  const [processingPurchase, setProcessingPurchase] = useState(false) // Local loading state for purchase actions
  const [purchaseApprovalNotes, setPurchaseApprovalNotes] = useState('') // Notes for purchase approval
  const [loadingPurchaseRequests, setLoadingPurchaseRequests] = useState(false) // Loading state for purchase requests
  const [openActionsDropdown, setOpenActionsDropdown] = useState(null)

  // Format vendor data for display
  const formatVendorForDisplay = (vendor, flaggedVendorIds = new Set()) => {
    const creditLimit = typeof vendor.creditLimit === 'number'
      ? vendor.creditLimit
      : parseFloat(vendor.creditLimit?.replace(/[₹,\sL]/g, '') || '0') * 100000

    const dues = typeof vendor.dues === 'number'
      ? vendor.dues
      : parseFloat(vendor.dues?.replace(/[₹,\sL]/g, '') || '0') * 100000

    const isFlagged = flaggedVendorIds.has(vendor.id)

    return {
      ...vendor,
      creditLimit: creditLimit >= 100000 ? `₹${(creditLimit / 100000).toFixed(1)} L` : `₹${creditLimit.toLocaleString('en-IN')}`,
      dues: dues >= 100000 ? `₹${(dues / 100000).toFixed(1)} L` : `₹${dues.toLocaleString('en-IN')}`,
      repayment: vendor.repaymentDays ? `${vendor.repaymentDays} days` : vendor.repayment || 'N/A',
      penalty: vendor.penaltyRate ? `${vendor.penaltyRate}%` : vendor.penalty || 'N/A',
      coverageRadius: vendor.coverageRadius ? `${vendor.coverageRadius} km` : 'N/A',
      coverageCompliance: isFlagged ? 'Conflict' : 'Compliant',
    }
  }

  // Fetch vendors
  const fetchVendors = useCallback(async () => {
    const result = await getVendors()
    const sourceVendors = result.data?.vendors || []
    setRawVendors(sourceVendors)
    const coverageInfo = computeCoverageReport(sourceVendors)
    setCoverageReport(coverageInfo)
    const flaggedSet = new Set(coverageInfo.flaggedVendors || [])
    const formatted = sourceVendors.map((vendor) => formatVendorForDisplay(vendor, flaggedSet))
    setAllVendorsList(formatted)
  }, [getVendors])

  // Filter vendors based on subRoute and search
  useEffect(() => {
    // Skip filtering if we're on purchase-requests subRoute
    if (subRoute === 'purchase-requests') {
      return
    }

    let filtered = allVendorsList

    // Filter by subRoute
    if (subRoute === 'on-track') {
      filtered = filtered.filter((v) => {
        const status = v.status?.toLowerCase() || ''
        return status === 'on track' || status === 'approved' || status === 'active'
      })
    } else if (subRoute === 'out-of-track') {
      filtered = filtered.filter((v) => {
        const status = v.status?.toLowerCase() || ''
        return status === 'delayed' || status === 'review' || status === 'pending' || status === 'rejected'
      })
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter((v) => {
        const name = (v.name || '').toLowerCase()
        const phone = (v.phone || '').replace(/\D/g, '')
        const email = (v.email || '').toLowerCase()
        const searchPhone = query.replace(/\D/g, '')

        return name.includes(query) ||
          phone.includes(searchPhone) ||
          email.includes(query) ||
          (v.id && v.id.toLowerCase().includes(query))
      })
    }

    setVendorsList(filtered)
  }, [subRoute, allVendorsList, searchQuery])

  // Fetch purchase requests
  const fetchPurchaseRequests = useCallback(async () => {
    setLoadingPurchaseRequests(true)
    try {
      const result = await getVendorPurchaseRequests({ status: 'pending' })
      if (result.data?.purchases) {
        setPurchaseRequests(result.data.purchases)
      }
    } catch (error) {
      console.error('Failed to fetch purchase requests:', error)
    } finally {
      setLoadingPurchaseRequests(false)
    }
  }, [getVendorPurchaseRequests])

  useEffect(() => {
    fetchVendors()
    fetchPurchaseRequests()
  }, [fetchVendors, fetchPurchaseRequests])

  // Handle purchase-requests subRoute - show purchase requests view
  useEffect(() => {
    if (subRoute === 'purchase-requests') {
      fetchPurchaseRequests()
      // Reset selected request when entering list view
      if (!currentView || currentView !== 'purchaseRequest') {
        setSelectedPurchaseRequest(null)
        setCurrentView(null)
      }
    } else if (subRoute !== 'purchase-requests' && currentView === 'purchaseRequest') {
      // Reset view when navigating away from purchase-requests
      setCurrentView(null)
      setSelectedPurchaseRequest(null)
      setPurchaseApprovalNotes('')
      setPurchaseRejectReason(null)
    }
  }, [subRoute, fetchPurchaseRequests, currentView])

  // Refresh when vendors are updated
  useEffect(() => {
    if (vendorsState.updated) {
      fetchVendors()
      fetchPurchaseRequests()
    }
  }, [vendorsState.updated, fetchVendors, fetchPurchaseRequests])

  const getVendorCoverageConflicts = (vendorId) => {
    if (!coverageReport?.conflicts) {
      return []
    }
    return coverageReport.conflicts.filter(
      (conflict) => conflict.vendorA.id === vendorId || conflict.vendorB.id === vendorId,
    )
  }

  const getRawVendorById = (vendorId) =>
    rawVendors.find((vendor) => vendor.id === vendorId) ||
    vendorsState.data?.vendors?.find((vendor) => vendor.id === vendorId)

  const withCoverageMeta = (vendor) => {
    if (!vendor) return vendor
    return {
      ...vendor,
      coverageRadius: vendor.coverageRadius || COVERAGE_RADIUS_KM,
      coverageConflicts: getVendorCoverageConflicts(vendor.id),
    }
  }

  const handleBanVendor = async (vendorId, banData) => {
    try {
      const result = await banVendor(vendorId, banData)
      if (result.data) {
        setCurrentView(null)
        setSelectedVendorForAction(null)
        setActionData(null)
        fetchVendors()
        success(`Vendor ${banData.banType === 'permanent' ? 'permanently' : 'temporarily'} banned successfully!`, 3000)
      } else if (result.error) {
        const errorMessage = result.error.message || 'Failed to ban vendor'
        showError(errorMessage, 5000)
      }
    } catch (error) {
      showError(error.message || 'Failed to ban vendor', 5000)
    }
  }

  const handleUnbanVendor = async (vendorId, unbanData) => {
    try {
      const result = await unbanVendor(vendorId, unbanData)
      if (result.data) {
        fetchVendors()
        success('Vendor ban revoked successfully!', 3000)
      } else if (result.error) {
        const errorMessage = result.error.message || 'Failed to unban vendor'
        showError(errorMessage, 5000)
      }
    } catch (error) {
      showError(error.message || 'Failed to unban vendor', 5000)
    }
  }

  const handleUpdateCreditPolicy = async (policyData) => {
    try {
      const result = await updateVendorCreditPolicy(selectedVendorForPolicy.id, policyData)
      if (result.data) {
        setCurrentView(null)
        setSelectedVendorForPolicy(null)
        fetchVendors()
        success('Credit policy updated successfully!', 4000)
      } else if (result.error) {
        const errorMessage = result.error.message || 'Failed to update credit policy'
        // Check if it's a warning about vendor not being approved
        if (errorMessage.includes('approved') || errorMessage.includes('status')) {
          showWarning(errorMessage, 6000)
        } else {
          showError(errorMessage, 5000)
        }
      }
    } catch (error) {
      const errorMessage = error.message || 'Failed to update credit policy'
      showError(errorMessage, 5000)
    }
  }

  const handleApproveVendor = async (vendorId) => {
    try {
      const result = await approveVendor(vendorId)
      if (result.success || result.data) {
        setCurrentView(null)
        setSelectedVendorForAction(null)
        success('Vendor approved successfully!', 3000)
        // Refresh vendors list
        const vendorsResult = await getVendors({})
        if (vendorsResult.data) {
          setRawVendors(vendorsResult.data.vendors || [])
        }
        fetchVendors()
      } else {
        const errorMessage = result.error?.message || 'Failed to approve vendor'
        showError(errorMessage, 5000)
      }
    } catch (error) {
      showError(error.message || 'Failed to approve vendor', 5000)
    }
  }

  const handleRejectVendor = async (vendorId, rejectionData) => {
    try {
      const result = await rejectVendor(vendorId, rejectionData)
      if (result.success || result.data) {
        setCurrentView(null)
        setSelectedVendorForAction(null)
        setActionData(null)
        success('Vendor application rejected.', 3000)
        // Refresh vendors list
        const vendorsResult = await getVendors({})
        if (vendorsResult.data) {
          setRawVendors(vendorsResult.data.vendors || [])
        }
        fetchVendors()
      } else {
        const errorMessage = result.error?.message || 'Failed to reject vendor'
        showError(errorMessage, 5000)
      }
    } catch (error) {
      showError(error.message || 'Failed to reject vendor', 5000)
    }
  }

  const handleApprovePurchase = async (requestId, shortDescription) => {
    // Use provided shortDescription or fallback to state
    const notes = shortDescription || purchaseApprovalNotes || ''
    const trimmedNotes = notes.trim()
    if (!trimmedNotes) {
      showError('Short description is required for approval', 3000)
      return
    }

    console.log('handleApprovePurchase called:', { requestId, shortDescription, trimmedNotes, stateValue: purchaseApprovalNotes })

    setProcessingPurchase(true)
    try {
      const result = await approveVendorPurchase(requestId, trimmedNotes)
      if (result.success && result.data) {
        setCurrentView(null)
        setSelectedPurchaseRequest(null)
        setPurchaseApprovalNotes('')
        setPurchaseRejectReason(null)
        fetchPurchaseRequests()
        fetchVendors()
        success('Vendor purchase request approved successfully!', 3000)
      } else {
        const errorMessage = result.error?.message || result.message || 'Failed to approve purchase request'
        console.error('Purchase approval error:', result)
        console.error('Error details:', {
          success: result.success,
          error: result.error,
          message: result.message,
          fullResult: JSON.stringify(result, null, 2)
        })
        console.error('Error message:', errorMessage)
        if (errorMessage.includes('credit') || errorMessage.includes('limit') || errorMessage.includes('insufficient') || errorMessage.includes('stock')) {
          showWarning(errorMessage, 6000)
        } else {
          showError(errorMessage, 5000)
        }
      }
    } catch (error) {
      console.error('Purchase approval exception:', error)
      showError(error.message || 'Failed to approve purchase request', 5000)
    } finally {
      setProcessingPurchase(false)
    }
  }

  const handleRejectPurchase = async (requestId, rejectionData) => {
    setProcessingPurchase(true)
    try {
      const result = await rejectVendorPurchase(requestId, rejectionData)
      if (result.data) {
        setCurrentView(null)
        setSelectedPurchaseRequest(null)
        setActionData(null)
        setPurchaseRejectReason(null)
        fetchPurchaseRequests()
        fetchVendors()
        success('Vendor purchase request rejected.', 3000)
      } else if (result.error) {
        const errorMessage = result.error.message || 'Failed to reject purchase request'
        showError(errorMessage, 5000)
      }
    } catch (error) {
      showError(error.message || 'Failed to reject purchase request', 5000)
    } finally {
      setProcessingPurchase(false)
    }
  }

  const handleViewVendorDetails = (vendor) => {
    const originalVendor = withCoverageMeta(getRawVendorById(vendor.id) || vendor)
    setSelectedVendorForDetail(originalVendor)
    setCurrentView('vendorDetail')
  }

  const handleViewVendorMap = (vendor) => {
    const originalVendor = withCoverageMeta(getRawVendorById(vendor.id) || vendor)
    setSelectedVendorForMap(originalVendor)
    setCurrentView('vendorMap')
  }

  const handleBackToList = () => {
    setCurrentView(null)
    setSelectedVendorForPolicy(null)
    setSelectedPurchaseRequest(null)
    setSelectedVendorForDetail(null)
    setSelectedVendorForMap(null)
    setSelectedVendorForAction(null)
    setSelectedVendorForEdit(null)
    setRejectReason('')
    setBanType('temporary')
    setBanReason('')
    setRevocationReason('')
    setPurchaseRejectReason(null)
    if (navigate) navigate('vendors')
  }

  const handleEditVendor = (vendor) => {
    const originalVendor = getRawVendorById(vendor.id) || vendor
    setSelectedVendorForEdit(originalVendor)
    setCurrentView('editVendor')
  }

  const handleSaveVendor = async (vendorData) => {
    try {
      const result = await updateVendor(selectedVendorForEdit.id, vendorData)
      if (result.data) {
        setCurrentView(null)
        setSelectedVendorForEdit(null)
        fetchVendors()
        success('Vendor information updated successfully!', 3000)
        if (navigate) navigate('vendors')
      } else if (result.error) {
        const errorMessage = result.error.message || 'Failed to update vendor'
        showError(errorMessage, 5000)
      }
    } catch (error) {
      showError(error.message || 'Failed to update vendor', 5000)
    }
  }


  const tableColumns = columns.map((column) => {
    if (column.accessor === 'status') {
      return {
        ...column,
        Cell: (row) => {
          const originalVendor = vendorsState.data?.vendors?.find((v) => v.id === row.id) || row
          const isBanned = originalVendor.banInfo?.isBanned || originalVendor.status === 'temporarily_banned' || originalVendor.status === 'permanently_banned'
          const banType = originalVendor.banInfo?.banType || (originalVendor.status === 'permanently_banned' ? 'permanent' : 'temporary')
          const status = isBanned ? (banType === 'permanent' ? 'Permanently Banned' : 'Temporarily Banned') : (row.status || 'Active')
          let tone = 'neutral'
          if (isBanned) {
            tone = 'error'
          } else if (status === 'approved' || status === 'active' || status === 'On Track' || status === 'on_track') {
            tone = 'success'
          } else if (status === 'Delayed' || status === 'delayed') {
            tone = 'warning'
          } else if (status === 'inactive' || status === 'blocked') {
            tone = 'error'
          }
          // Capitalize first letter for display
          const displayStatus = status.charAt(0).toUpperCase() + status.slice(1)
          return <StatusBadge tone={tone}>{displayStatus}</StatusBadge>
        },
      }
    }
    if (column.accessor === 'region') {
      return {
        ...column,
        Cell: (row) => (
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50 px-3 py-1 text-xs text-blue-700 font-bold shadow-[0_2px_8px_rgba(59,130,246,0.2),inset_0_1px_0_rgba(255,255,255,0.8)]">
            <MapPin className="h-3.5 w-3.5" />
            {row.region}
          </span>
        ),
      }
    }
    if (column.accessor === 'coverageRadius') {
      return {
        ...column,
        Cell: (row) => (
          <div className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-gray-900">{row.coverageRadius || 'N/A'}</span>
            <StatusBadge tone={row.coverageCompliance === 'Conflict' ? 'warning' : 'success'}>
              {row.coverageCompliance || 'Unknown'}
            </StatusBadge>
          </div>
        ),
      }
    }
    if (column.accessor === 'actions') {
      return {
        ...column,
        Cell: (row) => {
          const originalVendor = vendorsState.data?.vendors?.find((v) => v.id === row.id) || row
          const vendorStatus = originalVendor.status?.toLowerCase() || 'active'
          const isPending = vendorStatus === 'pending'
          const isRejected = vendorStatus === 'rejected'
          const isBanned = originalVendor.banInfo?.isBanned || originalVendor.status === 'temporarily_banned' || originalVendor.status === 'permanently_banned'
          const banType = originalVendor.banInfo?.banType || (originalVendor.status === 'permanently_banned' ? 'permanent' : 'temporary')
          const isDropdownOpen = openActionsDropdown === row.id

          const actionItems = [
            {
              label: 'View Location',
              icon: MapPin,
              onClick: () => {
                handleViewVendorMap(originalVendor)
                setOpenActionsDropdown(null)
              },
              className: 'text-gray-700 hover:bg-gray-50'
            },
            {
              label: 'View Details',
              icon: Eye,
              onClick: () => {
                handleViewVendorDetails(originalVendor)
                setOpenActionsDropdown(null)
              },
              className: 'text-gray-700 hover:bg-gray-50'
            },
            {
              label: 'Edit Info',
              icon: Edit2,
              onClick: () => {
                handleEditVendor(originalVendor)
                setOpenActionsDropdown(null)
              },
              className: 'text-gray-700 hover:bg-gray-50'
            }
          ]

          if (isPending) {
            actionItems.push({
              label: 'Approve Vendor',
              icon: CheckCircle,
              onClick: () => {
                setSelectedVendorForAction(originalVendor)
                setCurrentView('approveVendor')
                setOpenActionsDropdown(null)
              },
              className: 'text-[#017827] hover:bg-[rgba(1,120,39,0.05)]'
            })
            actionItems.push({
              label: 'Reject Vendor',
              icon: XCircle,
              onClick: () => {
                setSelectedVendorForAction(originalVendor)
                setRejectReason('')
                setCurrentView('rejectVendor')
                setOpenActionsDropdown(null)
              },
              className: 'text-red-700 hover:bg-red-50'
            })
          }

          if (!isBanned && !isPending && !isRejected) {
            actionItems.push({
              label: 'Update Credit Policy',
              icon: CreditCard,
              onClick: () => {
                setSelectedVendorForPolicy(originalVendor)
                setCurrentView('creditPolicy')
                setOpenActionsDropdown(null)
              },
              className: 'text-gray-700 hover:bg-gray-50'
            })
            actionItems.push({
              label: 'Ban Vendor',
              icon: Ban,
              onClick: () => {
                setSelectedVendorForAction(originalVendor)
                setBanType('temporary')
                setBanReason('')
                setCurrentView('banVendor')
                setOpenActionsDropdown(null)
              },
              className: 'text-red-700 hover:bg-red-50'
            })
          }

          if (isBanned && banType === 'temporary') {
            actionItems.push({
              label: 'Unban Vendor',
              icon: Unlock,
              onClick: () => {
                setSelectedVendorForAction(originalVendor)
                setRevocationReason('')
                setCurrentView('unbanVendor')
                setOpenActionsDropdown(null)
              },
              className: 'text-[#017827] hover:bg-[rgba(1,120,39,0.05)]'
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
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition-all hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700"
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

  // Render full-screen views
  if (currentView === 'editVendor' && selectedVendorForEdit) {
    return (
      <VendorEditForm
        vendor={selectedVendorForEdit}
        onSave={handleSaveVendor}
        onCancel={handleBackToList}
        loading={loading}
      />
    )
  }

  if (currentView === 'creditPolicy' && selectedVendorForPolicy) {
    return (
      <div className="space-y-6">
        <div>
          <button
            type="button"
            onClick={handleBackToList}
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200 hover:bg-gray-50 hover:shadow-[0_4px_12px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Vendors
          </button>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Step 3 • Vendor Management</p>
            <h2 className="text-2xl font-bold text-gray-900">Update Credit Policy</h2>
            <p className="text-sm text-gray-600">
              Configure credit limit, repayment terms, and penalty rates for {selectedVendorForPolicy.name}.
            </p>
          </div>
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
          <CreditPolicyForm
            vendor={selectedVendorForPolicy}
            onSubmit={handleUpdateCreditPolicy}
            onCancel={handleBackToList}
            loading={loading}
          />
        </div>
      </div>
    )
  }

  if (currentView === 'vendorDetail' && selectedVendorForDetail) {
    const vendor = selectedVendorForDetail
    const formatCurrency = (value) => {
      if (typeof value === 'string') return value
      if (value >= 100000) return `₹${(value / 100000).toFixed(1)} L`
      return `₹${value.toLocaleString('en-IN')}`
    }
    const creditLimit = typeof vendor.creditLimit === 'number'
      ? vendor.creditLimit
      : parseFloat(vendor.creditLimit?.replace(/[₹,\sL]/g, '') || '0') * 100000
    const dues = typeof vendor.dues === 'number'
      ? vendor.dues
      : parseFloat(vendor.dues?.replace(/[₹,\sL]/g, '') || '0') * 100000
    const creditUtilization = creditLimit > 0 ? ((dues / creditLimit) * 100).toFixed(1) : 0

    return (
      <div className="space-y-6">
        <div>
          <button
            type="button"
            onClick={handleBackToList}
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200 hover:bg-gray-50 hover:shadow-[0_4px_12px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Vendors
          </button>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Step 3 • Vendor Management</p>
            <h2 className="text-2xl font-bold text-gray-900">Vendor Details & Performance</h2>
            <p className="text-sm text-gray-600">
              Comprehensive view of vendor information, credit status, and performance metrics.
            </p>
          </div>
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
          <div className="space-y-6">
            {/* Vendor Header */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#017827] to-[#0a9937] text-white shadow-lg">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{vendor.name}</h3>
                    <p className="text-sm text-gray-600">Vendor ID: {vendor.id}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{vendor.region}</span>
                    </div>
                  </div>
                </div>
                <StatusBadge tone={vendor.status === 'On Track' || vendor.status === 'on_track' ? 'success' : vendor.status === 'Delayed' || vendor.status === 'delayed' ? 'warning' : 'neutral'}>
                  {vendor.status || 'Unknown'}
                </StatusBadge>
              </div>
            </div>

            {/* Credit Performance Metrics */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-500">Credit Limit</p>
                <p className="mt-1 text-lg font-bold text-gray-900">{formatCurrency(creditLimit)}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-500">Outstanding Dues</p>
                <p className="mt-1 text-lg font-bold text-red-600">{formatCurrency(dues)}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-500">Credit Utilization</p>
                <p className="mt-1 text-lg font-bold text-gray-900">{creditUtilization}%</p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      parseFloat(creditUtilization) > 80 ? 'bg-gradient-to-r from-red-500 to-red-600' : parseFloat(creditUtilization) > 60 ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' : 'bg-gradient-to-r from-[#017827] to-[#0a9937]',
                    )}
                    style={{ width: `${Math.min(creditUtilization, 100)}%` }}
                  />
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-500">Repayment Days</p>
                <p className="mt-1 text-lg font-bold text-gray-900">{vendor.repaymentDays || vendor.repayment || 'N/A'}</p>
              </div>
            </div>

            {/* Coverage & Policy */}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-blue-900">Coverage Radius</h4>
                    <p className="mt-2 text-2xl font-bold text-blue-900">
                      {vendor.coverageRadius ? `${vendor.coverageRadius} km` : 'N/A'}
                    </p>
                    {vendor.serviceArea && <p className="text-xs text-blue-700">{vendor.serviceArea}</p>}
                  </div>
                  <StatusBadge tone={vendor.coverageConflicts?.length ? 'warning' : 'success'}>
                    {vendor.coverageConflicts?.length ? 'Conflict' : 'Compliant'}
                  </StatusBadge>
                </div>
                {vendor.coverageConflicts?.length ? (
                  <ul className="mt-4 space-y-2 text-xs text-blue-900">
                    {vendor.coverageConflicts.map((conflict) => {
                      const otherVendor = conflict.vendorA.id === vendor.id ? conflict.vendorB : conflict.vendorA
                      return (
                        <li key={`${vendor.id}-${otherVendor.id}`} className="rounded-lg border border-blue-200 bg-white/80 px-3 py-2">
                          <p className="font-semibold">{otherVendor.name}</p>
                          <p className="text-[0.7rem] text-blue-700">
                            Distance: {conflict.distanceKm} km • Overlap: {conflict.overlapKm} km
                          </p>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="mt-4 text-xs text-blue-800">
                    No overlapping vendors detected within the 20 km exclusivity rule.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-[rgba(1,120,39,0.25)] bg-[rgba(1,120,39,0.04)] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-[#014a19]">Credit Policy</h4>
                    <div className="mt-2 grid gap-2 text-xs text-[#015c1f] sm:grid-cols-3">
                      <div>
                        <span className="font-semibold">Limit: </span>
                        <span>{formatCurrency(creditLimit)}</span>
                      </div>
                      <div>
                        <span className="font-semibold">Repayment: </span>
                        <span>{vendor.repaymentDays || vendor.repayment || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="font-semibold">Penalty: </span>
                        <span>{vendor.penaltyRate || vendor.penalty || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVendorForPolicy(vendor)
                      setCurrentView('creditPolicy')
                    }}
                    className="rounded-lg border border-[rgba(1,120,39,0.4)] bg-white px-4 py-2 text-xs font-bold text-[#017827] transition-all hover:bg-[rgba(1,120,39,0.1)]"
                  >
                    Update Policy
                  </button>
                </div>
              </div>
            </div>

            {/* Performance Alerts */}
            {parseFloat(creditUtilization) > 80 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="h-5 w-5 flex-shrink-0 text-red-600" />
                  <div>
                    <p className="text-sm font-bold text-red-900">High Credit Utilization Alert</p>
                    <p className="mt-1 text-xs text-red-700">
                      This vendor has exceeded 80% credit utilization. Consider reviewing their credit limit or requesting immediate repayment.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Verification Documents */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-gray-900">Verification Documents</h4>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Aadhaar Card */}
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <p className="text-xs font-semibold text-gray-700">Aadhaar Card</p>
                    </div>
                    {vendor.aadhaarCard?.url ? (
                      <CheckCircle className="h-4 w-4 text-[#017827]" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                  {vendor.aadhaarCard?.url ? (
                    <div className="space-y-2">
                      {vendor.aadhaarCard.format === 'pdf' ? (
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <FileText className="h-4 w-4 text-red-600" />
                          <span>PDF Document</span>
                        </div>
                      ) : (
                        <div className="rounded-lg overflow-hidden border border-gray-300 bg-white">
                          <img
                            src={vendor.aadhaarCard.url}
                            alt="Aadhaar Card"
                            className="w-full h-auto max-h-40 object-contain"
                            onError={(e) => {
                              e.target.style.display = 'none'
                            }}
                          />
                        </div>
                      )}
                      <a
                        href={vendor.aadhaarCard.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold"
                      >
                        <Eye className="h-3 w-3" />
                        View Document
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs text-red-600">Not uploaded</p>
                  )}
                </div>

                {/* PAN Card */}
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <p className="text-xs font-semibold text-gray-700">PAN Card</p>
                    </div>
                    {vendor.panCard?.url ? (
                      <CheckCircle className="h-4 w-4 text-[#017827]" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                  {vendor.panCard?.url ? (
                    <div className="space-y-2">
                      {vendor.panCard.format === 'pdf' ? (
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <FileText className="h-4 w-4 text-red-600" />
                          <span>PDF Document</span>
                        </div>
                      ) : (
                        <div className="rounded-lg overflow-hidden border border-gray-300 bg-white">
                          <img
                            src={vendor.panCard.url}
                            alt="PAN Card"
                            className="w-full h-auto max-h-40 object-contain"
                            onError={(e) => {
                              e.target.style.display = 'none'
                            }}
                          />
                        </div>
                      )}
                      <a
                        href={vendor.panCard.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold"
                      >
                        <Eye className="h-3 w-3" />
                        View Document
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs text-red-600">Not uploaded</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (currentView === 'vendorMap' && selectedVendorForMap) {
    return (
      <div className="space-y-6">
        <div>
          <button
            type="button"
            onClick={handleBackToList}
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200 hover:bg-gray-50 hover:shadow-[0_4px_12px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Vendors
          </button>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Step 3 • Vendor Management</p>
            <h2 className="text-2xl font-bold text-gray-900">{selectedVendorForMap.name} Location</h2>
            <p className="text-sm text-gray-600">
              View vendor location and coverage area on the map.
            </p>
          </div>
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
          <VendorMap vendor={selectedVendorForMap} className="h-[600px]" />
        </div>
      </div>
    )
  }

  if (currentView === 'purchaseRequest' && selectedPurchaseRequest) {
    const request = selectedPurchaseRequest
    const formatCurrency = (value) => {
      if (typeof value === 'string') return value
      if (value >= 100000) return `₹${(value / 100000).toFixed(1)} L`
      return `₹${value.toLocaleString('en-IN')}`
    }

    const handleRejectWithReason = () => {
      if (!purchaseRejectReason || !purchaseRejectReason.trim()) {
        showError('Please provide a reason for rejection', 3000)
        return
      }
      handleRejectPurchase(request.id, { reason: purchaseRejectReason.trim() })
    }

    const handleBackToVendors = () => {
      setCurrentView(null)
      setSelectedPurchaseRequest(null)
      setPurchaseRejectReason(null)
      setPurchaseApprovalNotes('')
      if (navigate) {
        navigate('vendors')
      }
    }

    return (
      <div className="space-y-6">
        <div>
          <button
            type="button"
            onClick={handleBackToVendors}
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200 hover:bg-gray-50 hover:shadow-[0_4px_12px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Vendors
          </button>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Step 3 • Vendor Management</p>
            <h2 className="text-2xl font-bold text-gray-900">Vendor Purchase Request Review</h2>
            <p className="text-sm text-gray-600">
              Review and approve or reject vendor purchase requests (minimum ₹50,000).
            </p>
          </div>
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
          <div className="space-y-6">
            {/* Request Header */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
                    <Package className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      Request #{request.id?.slice(-8) || request.requestId?.slice(-8) || 'N/A'}
                    </h3>
                    <p className="text-sm text-gray-600">Vendor: {request.vendorName || request.vendor}</p>
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                      {request.date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{new Date(request.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <StatusBadge tone={request.status === 'pending' ? 'warning' : request.status === 'approved' ? 'success' : 'neutral'}>
                  {request.status || 'Pending'}
                </StatusBadge>
              </div>
            </div>

            {/* Purchase Details */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-gray-900">Purchase Details</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs text-gray-500">Request Amount</p>
                  <p className="mt-1 text-lg font-bold text-gray-900">
                    {formatCurrency(request.amount || request.value || 0)}
                  </p>
                </div>
                {request.advance && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs text-gray-500">Advance Payment (30%)</p>
                    <p className="mt-1 text-lg font-bold text-gray-900">{formatCurrency(request.advance)}</p>
                  </div>
                )}
              </div>

              {request.products && request.products.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="mb-3 text-xs font-bold text-gray-500">Products Requested</p>
                  <div className="space-y-2">
                    {request.products.map((product, index) => {
                      // Format attribute label
                      const formatAttributeLabel = (key) => {
                        return key
                          .replace(/([A-Z])/g, ' $1')
                          .replace(/^./, str => str.toUpperCase())
                          .trim()
                      }

                      return (
                        <div key={index} className="rounded-lg bg-white p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold text-gray-900">{product.name || product}</span>
                            {product.quantity && (
                              <span className="text-xs text-gray-500">
                                Qty: {product.quantity} {product.unit || 'kg'}
                              </span>
                            )}
                          </div>
                          {/* Display variant attributes if present */}
                          {product.attributeCombination && Object.keys(product.attributeCombination).length > 0 && (
                            <div className="mt-2 space-y-1 pt-2 border-t border-gray-100">
                              {Object.entries(product.attributeCombination).map(([key, value]) => (
                                <div key={key} className="flex items-center gap-2 text-xs">
                                  <span className="text-gray-600 font-medium">{formatAttributeLabel(key)}:</span>
                                  <span className="text-gray-900">{value}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {product.price && (
                            <div className="mt-1 text-xs text-gray-500">
                              Price: ₹{product.price.toLocaleString('en-IN')}/{product.unit || 'kg'}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {request.description && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="mb-2 text-xs text-gray-500">Description</p>
                  <p className="text-sm text-gray-700">{request.description}</p>
                </div>
              )}
            </div>

            {/* Short Description Input (Required for Approval) */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <label className="mb-2 block text-sm font-bold text-gray-900">
                Short Description <span className="text-xs font-normal text-red-500">*</span>
                <span className="text-xs font-normal text-gray-500 ml-1">(Required for approval)</span>
              </label>
              <textarea
                value={purchaseApprovalNotes || ''}
                onChange={(e) => {
                  const value = e.target.value || ''
                  setPurchaseApprovalNotes(value)
                }}
                placeholder="Enter a short description for this approval (max 150 characters)"
                rows={3}
                maxLength={150}
                required
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm transition-all focus:border-[#017827] focus:outline-none focus:ring-2 focus:ring-[#017827]/50"
              />
              <p className="mt-1 text-xs text-gray-500">
                {(purchaseApprovalNotes || '').length}/150 characters
              </p>
            </div>

            {/* Rejection Reason Input (shown when rejecting) */}
            {purchaseRejectReason !== null && (
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <label className="mb-2 block text-sm font-bold text-gray-900">
                  Rejection Reason <span className="text-xs font-normal text-gray-500">(Required for rejection)</span>
                </label>
                <textarea
                  value={purchaseRejectReason}
                  onChange={(e) => setPurchaseRejectReason(e.target.value)}
                  placeholder="Enter reason for rejection"
                  rows={3}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm transition-all focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleBackToVendors}
                disabled={processingPurchase}
                className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (purchaseRejectReason === null) {
                      setPurchaseRejectReason('')
                    } else {
                      handleRejectWithReason()
                    }
                  }}
                  disabled={processingPurchase}
                  className="flex items-center gap-2 rounded-xl border border-red-300 bg-white px-6 py-3 text-sm font-bold text-red-600 transition-all hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <XCircle className="h-4 w-4" />
                  {purchaseRejectReason === null ? 'Reject' : 'Confirm Rejection'}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const notes = purchaseApprovalNotes || ''
                    const trimmedNotes = notes.trim()
                    console.log('Approve button clicked:', { notes, trimmedNotes, purchaseApprovalNotes })
                    if (!trimmedNotes) {
                      showError('Short description is required for approval', 3000)
                      return
                    }
                    handleApprovePurchase(request.id, trimmedNotes)
                  }}
                  disabled={processingPurchase || !(purchaseApprovalNotes || '').trim()}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#017827] to-[#0a9937] px-6 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(1, 120, 39,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:shadow-[0_6px_20px_rgba(1, 120, 39,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="h-4 w-4" />
                  {processingPurchase ? 'Processing...' : 'Approve Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Action views (Approve, Reject, Ban, Unban)
  if (currentView === 'approveVendor' && selectedVendorForAction) {
    return (
      <div className="space-y-6">
        <div>
          <button
            type="button"
            onClick={handleBackToList}
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200 hover:bg-gray-50 hover:shadow-[0_4px_12px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Vendors
          </button>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Step 3 • Vendor Management</p>
            <h2 className="text-2xl font-bold text-gray-900">Approve Vendor</h2>
            <p className="text-sm text-gray-600">
              Approve vendor application for {selectedVendorForAction.name}.
            </p>
          </div>
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-[rgba(1,120,39,0.25)] bg-[rgba(1,120,39,0.04)] p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#017827] to-[#0a9937] text-white shadow-lg">
                  <CheckCircle className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedVendorForAction.name}</h3>
                  <p className="text-sm text-gray-600">Vendor ID: {selectedVendorForAction.id}</p>
                  <p className="text-sm text-gray-600">Region: {selectedVendorForAction.region}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <p className="text-sm font-bold text-gray-900 mb-4">Are you sure you want to approve this vendor?</p>
              <p className="text-sm text-gray-600 mb-6">
                Once approved, the vendor will be able to access their dashboard and start receiving orders.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleBackToList}
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleApproveVendor(selectedVendorForAction.id)}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-gradient-to-r from-[#017827] to-[#0a9937] px-6 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(1, 120, 39,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:shadow-[0_6px_20px_rgba(1, 120, 39,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-50"
                >
                  {loading ? 'Approving...' : 'Approve Vendor'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (currentView === 'rejectVendor' && selectedVendorForAction) {
    return (
      <div className="space-y-6">
        <div>
          <button
            type="button"
            onClick={handleBackToList}
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200 hover:bg-gray-50 hover:shadow-[0_4px_12px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Vendors
          </button>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Step 3 • Vendor Management</p>
            <h2 className="text-2xl font-bold text-gray-900">Reject Vendor</h2>
            <p className="text-sm text-gray-600">
              Reject vendor application for {selectedVendorForAction.name}.
            </p>
          </div>
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg">
                  <XCircle className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedVendorForAction.name}</h3>
                  <p className="text-sm text-gray-600">Vendor ID: {selectedVendorForAction.id}</p>
                  <p className="text-sm text-gray-600">Region: {selectedVendorForAction.region}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <label className="mb-2 block text-sm font-bold text-gray-900">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter reason for rejection (optional)"
                rows={4}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm transition-all focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/50"
              />
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={handleBackToList}
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleRejectVendor(selectedVendorForAction.id, { reason: rejectReason || 'Application rejected by admin' })}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-6 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(239,68,68,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:shadow-[0_6px_20px_rgba(239,68,68,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-50"
                >
                  {loading ? 'Rejecting...' : 'Reject Vendor'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (currentView === 'banVendor' && selectedVendorForAction) {
    return (
      <div className="space-y-6">
        <div>
          <button
            type="button"
            onClick={handleBackToList}
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200 hover:bg-gray-50 hover:shadow-[0_4px_12px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Vendors
          </button>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Step 3 • Vendor Management</p>
            <h2 className="text-2xl font-bold text-gray-900">Ban Vendor</h2>
            <p className="text-sm text-gray-600">
              Ban vendor {selectedVendorForAction.name} temporarily or permanently.
            </p>
          </div>
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg">
                  <Ban className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedVendorForAction.name}</h3>
                  <p className="text-sm text-gray-600">Vendor ID: {selectedVendorForAction.id}</p>
                  <p className="text-sm text-gray-600">Region: {selectedVendorForAction.region}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <label className="mb-2 block text-sm font-bold text-gray-900">
                Ban Type <span className="text-red-500">*</span>
              </label>
              <div className="mb-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setBanType('temporary')}
                  className={cn(
                    'flex-1 rounded-xl border px-4 py-3 text-sm font-bold transition-all',
                    banType === 'temporary'
                      ? 'border-yellow-500 bg-gradient-to-br from-yellow-500 to-yellow-600 text-white shadow-[0_4px_15px_rgba(234,179,8,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-yellow-300 hover:bg-yellow-50',
                  )}
                >
                  Temporary
                </button>
                <button
                  type="button"
                  onClick={() => setBanType('permanent')}
                  className={cn(
                    'flex-1 rounded-xl border px-4 py-3 text-sm font-bold transition-all',
                    banType === 'permanent'
                      ? 'border-red-500 bg-gradient-to-br from-red-500 to-red-600 text-white shadow-[0_4px_15px_rgba(239,68,68,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50',
                  )}
                >
                  Permanent
                </button>
              </div>
              <label className="mb-2 block text-sm font-bold text-gray-900">
                Ban Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Enter reason for banning this vendor"
                rows={4}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm transition-all focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/50"
              />
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={handleBackToList}
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleBanVendor(selectedVendorForAction.id, { banType, banReason: banReason || 'Banned by admin' })}
                  disabled={loading || !banReason.trim()}
                  className="flex-1 rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-6 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(239,68,68,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:shadow-[0_6px_20px_rgba(239,68,68,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-50"
                >
                  {loading ? 'Banning...' : `Ban Vendor (${banType})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (currentView === 'unbanVendor' && selectedVendorForAction) {
    return (
      <div className="space-y-6">
        <div>
          <button
            type="button"
            onClick={handleBackToList}
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200 hover:bg-gray-50 hover:shadow-[0_4px_12px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Vendors
          </button>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Step 3 • Vendor Management</p>
            <h2 className="text-2xl font-bold text-gray-900">Unban Vendor</h2>
            <p className="text-sm text-gray-600">
              Revoke ban for vendor {selectedVendorForAction.name}.
            </p>
          </div>
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-[rgba(1,120,39,0.25)] bg-[rgba(1,120,39,0.04)] p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#017827] to-[#0a9937] text-white shadow-lg">
                  <Unlock className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedVendorForAction.name}</h3>
                  <p className="text-sm text-gray-600">Vendor ID: {selectedVendorForAction.id}</p>
                  <p className="text-sm text-gray-600">Region: {selectedVendorForAction.region}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <label className="mb-2 block text-sm font-bold text-gray-900">
                Revocation Reason <span className="text-xs font-normal text-gray-500">(Optional)</span>
              </label>
              <textarea
                value={revocationReason}
                onChange={(e) => setRevocationReason(e.target.value)}
                placeholder="Enter reason for revoking ban (optional)"
                rows={4}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm transition-all focus:border-[#017827] focus:outline-none focus:ring-2 focus:ring-[#017827]/50"
              />
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={handleBackToList}
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleUnbanVendor(selectedVendorForAction.id, { revocationReason: revocationReason || 'Ban revoked by admin' })}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-gradient-to-r from-[#017827] to-[#0a9937] px-6 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(1, 120, 39,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:shadow-[0_6px_20px_rgba(1, 120, 39,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-50"
                >
                  {loading ? 'Unbanning...' : 'Unban Vendor'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show purchase requests list view when subRoute is 'purchase-requests' and no specific request is selected
  if (subRoute === 'purchase-requests' && !selectedPurchaseRequest && !currentView) {
    return (
      <div className="space-y-6">
        <div>
          <button
            type="button"
            onClick={() => navigate('vendors')}
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200 hover:bg-gray-50 hover:shadow-[0_4px_12px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Vendors
          </button>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Step 3 • Vendor Management</p>
            <h2 className="text-2xl font-bold text-gray-900">Purchase Requests</h2>
            <p className="text-sm text-gray-600">
              Review and approve vendor purchase requests.
            </p>
          </div>
        </div>
        {loadingPurchaseRequests ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center">
            <p className="text-sm text-gray-600">Loading purchase requests...</p>
          </div>
        ) : purchaseRequests.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-sm font-semibold text-gray-900">No Purchase Requests</p>
              <p className="text-xs text-gray-600 mt-1">There are no pending purchase requests at the moment.</p>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
            <div className="space-y-3">
              {purchaseRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4 transition-all hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer"
                  onClick={() => {
                    setSelectedPurchaseRequest(request)
                    setCurrentView('purchaseRequest')
                  }}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <p className="font-bold text-gray-900">{request.vendorName || 'Unknown Vendor'}</p>
                      <StatusBadge tone="warning">Pending</StatusBadge>
                    </div>
                    <p className="mt-1 text-xs text-gray-600">
                      Request ID: {request.requestId || request.id} • Amount: ₹{(request.amount || request.value || 0).toLocaleString('en-IN')}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {request.date ? new Date(request.date).toLocaleDateString('en-IN') : 'N/A'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedPurchaseRequest(request)
                      setCurrentView('purchaseRequest')
                    }}
                    className="ml-4 flex h-9 w-9 items-center justify-center rounded-lg border border-blue-300 bg-white text-blue-600 transition-all hover:border-blue-500 hover:bg-blue-50"
                    title="Review request"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Main vendors list view
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Step 3 • Vendor Management</p>
          <h2 className="text-2xl font-bold text-gray-900">Credit Performance Dashboard</h2>
          <p className="text-sm text-gray-600">
            Control approvals, credit policies, and vendor risk in real time with proactive alerts.
          </p>
        </div>
        <div className="flex gap-2">
          {purchaseRequests.length > 0 && (
            <button
              onClick={() => {
                if (navigate) {
                  navigate('vendors/purchase-requests')
                } else {
                  setSelectedPurchaseRequest(purchaseRequests[0])
                  setCurrentView('purchaseRequest')
                }
              }}
              disabled={loadingPurchaseRequests}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-[0_4px_15px_rgba(59,130,246,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all duration-200 hover:shadow-[0_6px_20px_rgba(59,130,246,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Package className="h-4 w-4" />
              {loadingPurchaseRequests ? 'Loading...' : `Purchase Requests (${purchaseRequests.length})`}
            </button>
          )}
        </div>
      </header>

      {/* Search Bar */}
      <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vendors by name, phone, email, or ID..."
            className="w-full rounded-xl border border-gray-300 bg-white pl-12 pr-4 py-3 text-sm font-semibold transition-all focus:border-[#017827] focus:outline-none focus:ring-2 focus:ring-[#017827]/50"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <XCircle className="h-5 w-5" />
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="mt-2 text-xs text-gray-600">
            Found {vendorsList.length} vendor{vendorsList.length !== 1 ? 's' : ''} matching "{searchQuery}"
          </p>
        )}
      </div>

      <DataTable
        columns={tableColumns}
        rows={vendorsList}
        emptyState={searchQuery ? `No vendors found matching "${searchQuery}"` : "No vendor records found"}
      />

      {coverageReport && (
        <section className="space-y-5 rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/30 p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-blue-900">Coverage Compliance (20 km rule)</h3>
              <p className="text-sm text-blue-700">
                Ensure exclusive vendor coverage per 20 km radius. Automated monitoring across all mapped vendors.
              </p>
            </div>
            <StatusBadge tone={coverageReport.conflicts.length ? 'warning' : 'success'}>
              {coverageReport.conflicts.length ? `${coverageReport.conflicts.length} conflict(s)` : 'All zones compliant'}
            </StatusBadge>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-blue-200 bg-white p-4">
              <p className="text-xs text-blue-500">Vendors with Geo Coverage</p>
              <p className="mt-1 text-2xl font-bold text-blue-900">{coverageReport.total}</p>
              <p className="text-[0.7rem] text-blue-700">Mapped with latitude & longitude</p>
            </div>
            <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
              <p className="text-xs text-yellow-600">Conflict Zones</p>
              <p className="mt-1 text-2xl font-bold text-yellow-800">{coverageReport.flaggedVendors?.length || 0}</p>
              <p className="text-[0.7rem] text-yellow-700">Vendors requiring reassignment</p>
            </div>
            <div className="rounded-2xl border border-[rgba(1,120,39,0.25)] bg-[rgba(1,120,39,0.04)] p-4">
              <p className="text-xs text-[#017827]">Compliant Zones</p>
              <p className="mt-1 text-2xl font-bold text-[#015c1f]">{coverageReport.compliantCount}</p>
              <p className="text-[0.7rem] text-[#017827]">Operating within exclusive radius</p>
            </div>
          </div>

          {coverageReport.conflicts.length > 0 ? (
            <div className="space-y-3">
              {coverageReport.conflicts.map((conflict) => (
                <div
                  key={conflict.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4"
                >
                  <div>
                    <p className="text-sm font-bold text-red-900">
                      {conflict.vendorA.name} ↔ {conflict.vendorB.name}
                    </p>
                    <p className="text-xs text-red-700">
                      Distance: {conflict.distanceKm} km • Overlap risk: {conflict.overlapKm} km inside 20 km rule
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleViewVendorMap(conflict.vendorA)}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-blue-500 hover:text-blue-700"
                    >
                      View {conflict.vendorA.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleViewVendorMap(conflict.vendorB)}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-blue-500 hover:text-blue-700"
                    >
                      View {conflict.vendorB.name}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-[rgba(1,120,39,0.25)] bg-white p-4 text-xs text-[#017827]">
              All vendor coverage areas comply with the 20 km exclusivity policy.
            </div>
          )}
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-3xl border border-[rgba(1,120,39,0.25)] bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
          <h3 className="text-lg font-bold text-[#017827]">Credit Policy Playbook</h3>
          <p className="text-sm text-gray-600">
            Configure region-wise credit strategies, repayment cycles, and penalty protocols.
          </p>
          <div className="space-y-4">
            {[
              {
                title: 'Credit Limit Review',
                description:
                  'Identify vendors nearing 80% credit utilization. Initiate auto alerts and escalate to finance for manual override.',
                meta: 'Updated daily at 09:00',
              },
              {
                title: 'Repayment Monitoring',
                description:
                  'Flag repayments that exceed threshold by >7 days. Auto-calculate penalties and generate repayment reminders.',
                meta: 'SLA: 24h resolution',
              },
              {
                title: 'Purchase Approval (≥₹50,000)',
                description:
                  'Streamline manual approvals with supporting documents. Auto populate vendor performance insights before approval.',
                meta: `Pending approvals: ${purchaseRequests.length}`,
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-gray-200 bg-white p-4 transition hover:-translate-y-1 hover:shadow-[0_6px_20px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]">
                <div className="flex items-center justify-between text-sm font-bold text-gray-900">
                  <span>{item.title}</span>
                  <CreditCard className="h-4 w-4 text-[#017827]" />
                </div>
                <p className="mt-2 text-xs text-gray-600">{item.description}</p>
                <p className="mt-3 text-xs font-bold text-[#017827]">{item.meta}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4 rounded-3xl border border-red-200 bg-gradient-to-br from-red-50 to-red-100/50 p-6 shadow-[0_4px_15px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-red-600" />
            <div>
              <h3 className="text-lg font-bold text-gray-900">High Risk Alerts</h3>
              <p className="text-sm text-red-700">
                Automatic penalty application and collections follow-up. Review overdue repayments immediately.
              </p>
            </div>
          </div>
          <Timeline
            events={[
              {
                id: 'risk-1',
                title: 'HarvestLink Pvt Ltd',
                timestamp: 'Due in 2 days',
                description: '₹19.6 L pending. Escalated to finance with penalty rate 2%.',
                status: 'pending',
              },
              {
                id: 'risk-2',
                title: 'GrowSure Traders',
                timestamp: 'Settled today',
                description: 'Repayment received. Credit reinstated with new limit ₹28 L.',
                status: 'completed',
              },
              {
                id: 'risk-3',
                title: 'AgroSphere Logistics',
                timestamp: 'Overdue by 5 days',
                description: 'Penalty 1.5% applied. Legal notice scheduled.',
                status: 'pending',
              },
            ]}
          />
        </div>
      </section>


    </div>
  )
}

