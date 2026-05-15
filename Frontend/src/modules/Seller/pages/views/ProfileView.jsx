import { useState } from 'react'
import { useSellerState, useSellerDispatch } from '../../context/SellerContext'
import { useSellerApi } from '../../hooks/useSellerApi'
import { sellerSnapshot } from '../../services/sellerData'
import {
  UserIcon,
  HelpCircleIcon,
  EditIcon,
  XIcon,
  BuildingIcon,
  MapPinIcon,
  ChevronRightIcon,
} from '../../components/icons'
import { cn } from '../../../../lib/cn'
import { useToast } from '../../components/ToastNotification'
import { Trans } from '../../../../components/Trans'
import { TransText } from '../../../../components/TransText'
import { useTranslation } from '../../../../context/TranslationContext'

export function ProfileView({ onLogout, onNavigate }) {
  const { profile } = useSellerState()
  const dispatch = useSellerDispatch()
  const { translate } = useTranslation()
  const {
    requestNameChange,
    requestPhoneChange,
    reportIssue,
    getSupportTickets,
    getSupportTicketDetails,
    sendSupportMessage
  } = useSellerApi()
  const { success, warning, error: showError } = useToast()

  const [showNameChangePanel, setShowNameChangePanel] = useState(false)
  const [showPhoneChangePanel, setShowPhoneChangePanel] = useState(false)
  const [showSupportPanel, setShowSupportPanel] = useState(false)
  const [showReportPanel, setShowReportPanel] = useState(false)
  const [showTicketsPanel, setShowTicketsPanel] = useState(false)
  const [showTicketDetailsPanel, setShowTicketDetailsPanel] = useState(false)
  const [tickets, setTickets] = useState([])
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [ticketDetailsLoading, setTicketDetailsLoading] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [isSendingMessage, setIsSendingMessage] = useState(false)

  // Name change request form
  const [nameChangeForm, setNameChangeForm] = useState({
    requestedName: '',
    confirmName: '',
  })

  // Phone change request form
  const [phoneChangeForm, setPhoneChangeForm] = useState({
    requestedPhone: '',
    confirmPhone: '',
  })

  // Report issue form
  const [reportForm, setReportForm] = useState({
    subject: '',
    description: '',
    category: 'general',
  })

  const handleRequestNameChange = async () => {
    if (!nameChangeForm.requestedName.trim()) {
      warning(<Trans>Please enter the new name</Trans>)
      return
    }
    if (nameChangeForm.requestedName.trim() !== nameChangeForm.confirmName.trim()) {
      warning(<Trans>Name confirmation does not match. Please enter the same name in both fields.</Trans>)
      return
    }
    try {
      const result = await requestNameChange({
        requestedName: nameChangeForm.requestedName.trim(),
        description: '',
      })
      if (result && (result.success || (result.data && !result.error))) {
        setNameChangeForm({ requestedName: '', confirmName: '' })
        setShowNameChangePanel(false)
        success(<Trans>Name change request sent to Admin. Kindly wait for the Admin approval.</Trans>)
      } else if (result && result.error) {
        showError(result.error.message || <Trans>Failed to submit name change request</Trans>)
      } else {
        showError(<Trans>Failed to submit name change request. Please try again.</Trans>)
      }
    } catch (err) {
      showError(err.message || <Trans>Failed to submit name change request</Trans>)
    }
  }

  const handleRequestPhoneChange = async () => {
    if (!phoneChangeForm.requestedPhone.trim()) {
      warning(<Trans>Please enter the new phone number</Trans>)
      return
    }
    const phoneRegex = /^[+]?[1-9]\d{9,14}$/
    if (!phoneRegex.test(phoneChangeForm.requestedPhone.trim())) {
      warning(<Trans>Please enter a valid phone number</Trans>)
      return
    }
    if (phoneChangeForm.requestedPhone.trim() !== phoneChangeForm.confirmPhone.trim()) {
      warning(<Trans>Phone confirmation does not match. Please enter the same phone number in both fields.</Trans>)
      return
    }
    try {
      const result = await requestPhoneChange({
        requestedPhone: phoneChangeForm.requestedPhone.trim(),
        description: '',
      })
      if (result && result.success) {
        setPhoneChangeForm({ requestedPhone: '', confirmPhone: '' })
        setShowPhoneChangePanel(false)
        success(<Trans>Phone number change request sent to Admin. Kindly wait for the Admin approval.</Trans>)
      } else if (result && result.error) {
        showError(result.error.message || <Trans>Failed to submit phone change request</Trans>)
      } else {
        showError(<Trans>Failed to submit phone change request. Please try again.</Trans>)
      }
    } catch (err) {
      showError(err.message || <Trans>Failed to submit phone change request</Trans>)
    }
  }

  const handleSubmitReport = async () => {
    if (!reportForm.subject || !reportForm.description) {
      warning(<Trans>Please fill in all fields</Trans>)
      return
    }
    try {
      const result = await reportIssue({
        subject: reportForm.subject,
        description: reportForm.description,
        category: reportForm.category,
      })
      if (result.success || result.data) {
        success(<Trans>Issue reported successfully! We will get back to you soon.</Trans>)
        setReportForm({ subject: '', description: '', category: 'general' })
        setShowReportPanel(false)
        fetchTickets()
      } else if (result.error) {
        showError(result.error.message || <Trans>Failed to submit report</Trans>)
      }
    } catch (err) {
      showError(err.message || <Trans>Failed to submit report</Trans>)
    }
  }

  const fetchTickets = async () => {
    setTicketsLoading(true)
    try {
      const result = await getSupportTickets({ limit: 50 })
      if (result.success || result.data) {
        setTickets((result.data?.tickets || result.data) || [])
      }
    } catch (error) {
      console.error('Error fetching tickets:', error)
    } finally {
      setTicketsLoading(false)
    }
  }

  const fetchTicketDetails = async (ticketId) => {
    setTicketDetailsLoading(true)
    try {
      const result = await getSupportTicketDetails(ticketId)
      if (result.success || result.data) {
        setSelectedTicket(result.data)
        setShowTicketDetailsPanel(true)
      } else {
        showError(result.error?.message || result.message || <Trans>Failed to fetch ticket details</Trans>)
      }
    } catch (error) {
      console.error('Error fetching ticket details:', error)
      showError(error.error?.message || <Trans>Failed to fetch ticket details</Trans>)
    } finally {
      setTicketDetailsLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket?.ticket?.id) return
    setIsSendingMessage(true)
    try {
      const result = await sendSupportMessage(selectedTicket.ticket.id, { message: newMessage.trim() })
      if (result.success || result.data) {
        setNewMessage('')
        // Refresh details
        const updatedDetails = await getSupportTicketDetails(selectedTicket.ticket.id)
        if (updatedDetails.success || updatedDetails.data) {
          setSelectedTicket(updatedDetails.data)
        }
      } else {
        showError(result.error?.message || result.message || <Trans>Failed to send message</Trans>)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      showError(error.error?.message || <Trans>Failed to send message</Trans>)
    } finally {
      setIsSendingMessage(false)
    }
  }

  const sellerProfile = profile.name ? profile : sellerSnapshot.profile

  const sections = [
    {
      id: 'seller-info',
      title: <Trans>Seller Information</Trans>,
      icon: UserIcon,
      items: [
        {
          id: 'name',
          label: <Trans>Full Name</Trans>,
          value: sellerProfile.name,
          editable: true,
          onEdit: () => setShowNameChangePanel(true),
        },
        {
          id: 'seller-id',
          label: <Trans>Seller ID</Trans>,
          value: sellerProfile.sellerId || sellerSnapshot.profile.sellerId,
          editable: false,
        },
        {
          id: 'phone',
          label: <Trans>Phone</Trans>,
          value: sellerProfile.phone || sellerSnapshot.profile.phone || <Trans>Not set</Trans>,
          editable: true,
          onEdit: () => setShowPhoneChangePanel(true),
        },
      ],
    },
    {
      id: 'business',
      title: <Trans>Business Details</Trans>,
      icon: BuildingIcon,
      items: [
        {
          id: 'location',
          label: <Trans>Location</Trans>,
          value: sellerProfile.area || sellerSnapshot.profile.area || sellerProfile.location?.city || sellerProfile.location?.state || <Trans>Not set</Trans>,
          editable: false,
        },
        {
          id: 'commission',
          label: <Trans>Commission Rate</Trans>,
          value: sellerProfile.commissionRate || sellerSnapshot.profile.commissionRate || <Trans>Not set</Trans>,
          editable: false,
        },
        {
          id: 'cashback',
          label: <Trans>Cashback Rate</Trans>,
          value: sellerProfile.cashbackRate || sellerSnapshot.profile.cashbackRate || <Trans>Not set</Trans>,
          editable: false,
        },
      ],
    },
    {
      id: 'support',
      title: <Trans>Support & Help</Trans>,
      icon: HelpCircleIcon,
      items: [
        {
          id: 'help',
          label: <Trans>Help Center</Trans>,
          value: <Trans>FAQs & Guides</Trans>,
          action: () => setShowSupportPanel(true),
        },
        {
          id: 'contact',
          label: <Trans>Contact Support</Trans>,
          value: <Trans>Chat or Call</Trans>,
          action: () => setShowSupportPanel(true),
        },
        {
          id: 'report',
          label: <Trans>Report Issue</Trans>,
          value: <Trans>Report a problem</Trans>,
          action: () => setShowReportPanel(true),
        },
        {
          id: 'tickets',
          label: <Trans>My Support Tickets</Trans>,
          value: <Trans>View & track tickets</Trans>,
          action: () => {
            setShowTicketsPanel(true)
            fetchTickets()
          },
        },
      ],
    },
  ]

  return (
    <div className="seller-profile-view space-y-6">
      {/* Profile Header */}
      <div className="seller-profile-view__header">
        <div className="seller-profile-view__header-avatar">
          <UserIcon className="h-12 w-12" />
        </div>
        <div className="seller-profile-view__header-info">
          <h2 className="seller-profile-view__header-name"><TransText>{sellerProfile.name}</TransText></h2>
          <p className="seller-profile-view__header-id"><TransText>Seller ID: {{ id: sellerProfile.sellerId || sellerSnapshot.profile.sellerId }}</TransText></p>
          <p className="seller-profile-view__header-location">
            <MapPinIcon className="h-4 w-4 inline mr-1" />
            <TransText>{sellerProfile.area || sellerSnapshot.profile.area || sellerProfile.location?.city || sellerProfile.location?.state || 'Location not set'}</TransText>
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="seller-profile-view__sections">
        {sections.map((section) => (
          <div key={section.id} className="seller-profile-view__section">
            <div className="seller-profile-view__section-header">
              <section.icon className="seller-profile-view__section-icon" />
              <h3 className="seller-profile-view__section-title">{section.title}</h3>
            </div>
            <div className="seller-profile-view__section-content">
              {section.items.map((item) => (
                <div key={item.id} className="seller-profile-view__item">
                  <div className="seller-profile-view__item-content">
                    <span className="seller-profile-view__item-label">{item.label}</span>
                    <span className="seller-profile-view__item-value">
                      {typeof item.value === 'string' ? <TransText>{item.value}</TransText> : item.value}
                    </span>
                  </div>
                  <div className="seller-profile-view__item-actions">
                    {item.editable && (
                      <button
                        type="button"
                        className="seller-profile-view__item-edit"
                        onClick={item.onEdit}
                      >
                        <EditIcon className="h-4 w-4" />
                      </button>
                    )}
                    {item.action && (
                      <button
                        type="button"
                        className="seller-profile-view__item-action"
                        onClick={item.action}
                      >
                        →
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Logout Button */}
      <div className="seller-profile-view__logout">
        <button
          type="button"
          onClick={onLogout}
          className="seller-profile-view__logout-button"
        >
          <Trans>Sign Out</Trans>
        </button>
      </div>

      {/* Name Change Request Panel */}
      {showNameChangePanel && (
        <div
          className="seller-profile-view__panel"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowNameChangePanel(false)
              setNameChangeForm({ requestedName: '', confirmName: '' })
            }
          }}
        >
          <div className="seller-profile-view__panel-content">
            <div className="seller-profile-view__panel-header">
              <h3 className="seller-profile-view__panel-title"><Trans>Request Name Change</Trans></h3>
              <button
                type="button"
                onClick={() => {
                  setShowNameChangePanel(false)
                  setNameChangeForm({ requestedName: '', confirmName: '' })
                }}
                className="seller-profile-view__panel-close"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="seller-profile-view__panel-body">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[#172022] mb-1.5">
                    <Trans>Current Name</Trans>
                  </label>
                  <input
                    type="text"
                    value={sellerProfile.name}
                    disabled
                    className="w-full px-3 py-2.5 rounded-lg border border-[rgba(1, 78, 23,0.15)] bg-gray-50 text-sm text-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#172022] mb-1.5">
                    <Trans>New Name</Trans> <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={nameChangeForm.requestedName}
                    onChange={(e) => setNameChangeForm({ ...nameChangeForm, requestedName: e.target.value })}
                    placeholder={translate('Write your suggested name')}
                    className="w-full px-3 py-2.5 rounded-lg border border-[rgba(1, 78, 23,0.15)] bg-white text-sm focus:outline-none focus:border-[#017827]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#172022] mb-1.5">
                    <Trans>Confirm Name</Trans> <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={nameChangeForm.confirmName}
                    onChange={(e) => setNameChangeForm({ ...nameChangeForm, confirmName: e.target.value })}
                    placeholder={translate('Enter the name again to confirm')}
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none ${nameChangeForm.confirmName && nameChangeForm.requestedName.trim() !== nameChangeForm.confirmName.trim()
                      ? 'border-red-300 bg-red-50 focus:border-red-500'
                      : 'border-[rgba(1, 78, 23,0.15)] bg-white focus:border-[#017827]'
                      }`}
                  />
                  {nameChangeForm.confirmName && nameChangeForm.requestedName.trim() !== nameChangeForm.confirmName.trim() && (
                    <p className="mt-1 text-xs text-red-600"><Trans>Name does not match. Please enter the same name.</Trans></p>
                  )}
                </div>
              </div>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleRequestNameChange}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#017827] text-white text-sm font-semibold hover:bg-[#0a9937] transition-colors"
                >
                  <Trans>Submit Request</Trans>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phone Change Request Panel */}
      {showPhoneChangePanel && (
        <div
          className="seller-profile-view__panel"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPhoneChangePanel(false)
              setPhoneChangeForm({ requestedPhone: '', confirmPhone: '' })
            }
          }}
        >
          <div className="seller-profile-view__panel-content">
            <div className="seller-profile-view__panel-header">
              <h3 className="seller-profile-view__panel-title"><Trans>Request Phone Change</Trans></h3>
              <button
                type="button"
                onClick={() => {
                  setShowPhoneChangePanel(false)
                  setPhoneChangeForm({ requestedPhone: '', confirmPhone: '' })
                }}
                className="seller-profile-view__panel-close"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="seller-profile-view__panel-body">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[#172022] mb-1.5">
                    <Trans>Current Phone</Trans>
                  </label>
                  <input
                    type="text"
                    value={sellerProfile.phone || translate('Not set')}
                    disabled
                    className="w-full px-3 py-2.5 rounded-lg border border-[rgba(1, 78, 23,0.15)] bg-gray-50 text-sm text-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#172022] mb-1.5">
                    <Trans>New Phone Number</Trans> <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={phoneChangeForm.requestedPhone}
                    onChange={(e) => setPhoneChangeForm({ ...phoneChangeForm, requestedPhone: e.target.value })}
                    placeholder={translate('Write your suggested phone number to change')}
                    className="w-full px-3 py-2.5 rounded-lg border border-[rgba(1, 78, 23,0.15)] bg-white text-sm focus:outline-none focus:border-[#017827]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#172022] mb-1.5">
                    <Trans>Confirm Phone Number</Trans> <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={phoneChangeForm.confirmPhone}
                    onChange={(e) => setPhoneChangeForm({ ...phoneChangeForm, confirmPhone: e.target.value })}
                    placeholder={translate('Enter the phone number again to confirm')}
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none ${phoneChangeForm.confirmPhone && phoneChangeForm.requestedPhone.trim() !== phoneChangeForm.confirmPhone.trim()
                      ? 'border-red-300 bg-red-50 focus:border-red-500'
                      : 'border-[rgba(1, 78, 23,0.15)] bg-white focus:border-[#017827]'
                      }`}
                  />
                  {phoneChangeForm.confirmPhone && phoneChangeForm.requestedPhone.trim() !== phoneChangeForm.confirmPhone.trim() && (
                    <p className="mt-1 text-xs text-red-600"><Trans>Phone number does not match. Please enter the same phone number.</Trans></p>
                  )}
                </div>
              </div>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleRequestPhoneChange}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#017827] text-white text-sm font-semibold hover:bg-[#0a9937] transition-colors"
                >
                  <Trans>Submit Request</Trans>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Support Panel */}
      {showSupportPanel && (
        <div
          className="seller-profile-view__panel"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowSupportPanel(false)
            }
          }}
        >
          <div className="seller-profile-view__panel-content">
            <div className="seller-profile-view__panel-header">
              <h3 className="seller-profile-view__panel-title"><Trans>Support & Help</Trans></h3>
              <button
                type="button"
                onClick={() => setShowSupportPanel(false)}
                className="seller-profile-view__panel-close"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="seller-profile-view__panel-body">
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[rgba(240,245,242,0.4)] border border-[rgba(1, 78, 23,0.1)]">
                  <h4 className="font-semibold text-[#172022] mb-2"><Trans>Help Center</Trans></h4>
                  <p className="text-sm text-[rgba(26,42,34,0.7)] mb-3">
                    <Trans>Browse FAQs and guides to find answers to common questions.</Trans>
                  </p>
                  <button
                    type="button"
                    className="text-sm text-[#017827] font-semibold hover:underline"
                  >
                    <Trans>Visit Help Center →</Trans>
                  </button>
                </div>
                <div className="p-4 rounded-xl bg-[rgba(240,245,242,0.4)] border border-[rgba(1, 78, 23,0.1)]">
                  <h4 className="font-semibold text-[#172022] mb-2"><Trans>Contact Support</Trans></h4>
                  <p className="text-sm text-[rgba(26,42,34,0.7)] mb-2">
                    <strong><Trans>Phone:</Trans></strong> +91 1800-XXX-XXXX
                  </p>
                  <p className="text-sm text-[rgba(26,42,34,0.7)] mb-3">
                    <strong><Trans>Email:</Trans></strong> support@irasathi.com
                  </p>
                  <p className="text-sm text-[rgba(26,42,34,0.7)] mb-3">
                    <strong><Trans>Hours:</Trans></strong> <Trans>Mon-Sat, 9 AM - 6 PM</Trans>
                  </p>
                  <button
                    type="button"
                    className="text-sm text-[#017827] font-semibold hover:underline"
                  >
                    <Trans>Start Chat →</Trans>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Issue Panel */}
      {showReportPanel && (
        <div
          className="seller-profile-view__panel"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowReportPanel(false)
              setReportForm({ subject: '', description: '', category: 'general' })
            }
          }}
        >
          <div className="seller-profile-view__panel-content">
            <div className="seller-profile-view__panel-header">
              <h3 className="seller-profile-view__panel-title"><Trans>Report Issue</Trans></h3>
              <button
                type="button"
                onClick={() => {
                  setShowReportPanel(false)
                  setReportForm({ subject: '', description: '', category: 'general' })
                }}
                className="seller-profile-view__panel-close"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="seller-profile-view__panel-body">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[#172022] mb-1.5">
                    <Trans>Category</Trans> <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={reportForm.category}
                    onChange={(e) => setReportForm({ ...reportForm, category: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-[rgba(1, 78, 23,0.15)] bg-white text-sm focus:outline-none focus:border-[#017827]"
                  >
                    <option value="general">{translate('General Issue')}</option>
                    <option value="commission">{translate('Commission Issue')}</option>
                    <option value="vendor">{translate('Vendor Issue')}</option>
                    <option value="account">{translate('Account Issue')}</option>
                    <option value="other">{translate('Other')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#172022] mb-1.5">
                    <Trans>Subject</Trans> <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={reportForm.subject}
                    onChange={(e) => setReportForm({ ...reportForm, subject: e.target.value })}
                    placeholder={translate('Brief description of the issue')}
                    className="w-full px-3 py-2.5 rounded-lg border border-[rgba(1, 78, 23,0.15)] bg-white text-sm focus:outline-none focus:border-[#017827]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#172022] mb-1.5">
                    <Trans>Description</Trans> <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={reportForm.description}
                    onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                    placeholder={translate('Please provide detailed information about the issue')}
                    rows={5}
                    className="w-full px-3 py-2.5 rounded-lg border border-[rgba(1, 78, 23,0.15)] bg-white text-sm focus:outline-none focus:border-[#017827] resize-none"
                  />
                </div>
              </div>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleSubmitReport}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#017827] text-white text-sm font-semibold hover:bg-[#0a9937] transition-colors"
                >
                  <Trans>Submit Report</Trans>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Support Tickets Panel */}
      {showTicketsPanel && (
        <div
          className="seller-profile-view__panel"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowTicketsPanel(false)
          }}
        >
          <div className="seller-profile-view__panel-content shadow-2xl">
            <div className="seller-profile-view__panel-header">
              <h3 className="seller-profile-view__panel-title font-bold"><Trans>My Support Tickets</Trans></h3>
              <button
                type="button"
                onClick={() => setShowTicketsPanel(false)}
                className="seller-profile-view__panel-close"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="seller-profile-view__panel-body p-0">
              {ticketsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white">
                  <div className="w-10 h-10 border-4 border-[rgba(1, 120, 39,0.1)] border-t-[#017827] rounded-full animate-spin mb-4"></div>
                  <p className="text-sm font-medium text-[rgba(26,42,34,0.6)]"><Trans>Loading tickets...</Trans></p>
                </div>
              ) : tickets.length > 0 ? (
                <div className="divide-y divide-[rgba(1, 78, 23,0.08)] bg-white">
                  {tickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      onClick={() => fetchTicketDetails(ticket.id)}
                      className="w-full text-left p-4 hover:bg-[rgba(1, 120, 39,0.02)] transition-colors flex items-center justify-between group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-[#017827] uppercase tracking-wider">{ticket.ticketId}</span>
                          {ticket.hasUnread && (
                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-[#172022] truncate group-hover:text-[#017827] transition-colors">
                          {ticket.subject}
                        </h4>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase",
                            ticket.status === 'open' ? "bg-blue-100 text-blue-700" :
                              ticket.status === 'in_progress' ? "bg-amber-100 text-amber-700" :
                                ticket.status === 'resolved' ? "bg-[rgba(1,120,39,0.1)] text-[#017827]" :
                                  "bg-gray-100 text-gray-700"
                          )}>
                            <Trans>{ticket.status.replace('_', ' ')}</Trans>
                          </span>
                          <span className="text-[10px] text-[rgba(26,42,34,0.5)] font-bold">
                            {new Date(ticket.lastActivityAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <ChevronRightIcon className="h-5 w-5 text-[rgba(26,42,34,0.3)] group-hover:text-[#017827] group-hover:translate-x-0.5 transition-all" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 px-6 text-center bg-white">
                  <div className="w-16 h-16 rounded-full bg-[rgba(1, 120, 39,0.05)] flex items-center justify-center mb-4">
                    <HelpCircleIcon className="w-8 h-8 text-[#017827] opacity-40" />
                  </div>
                  <h4 className="text-base font-bold text-[#172022] mb-1"><Trans>No tickets yet</Trans></h4>
                  <p className="text-sm font-medium text-[rgba(26,42,34,0.6)] max-w-xs mx-auto mb-6">
                    <Trans>If you have any issues or questions, you can report them and we'll help you resolve them.</Trans>
                  </p>
                  <button
                    onClick={() => {
                      setShowTicketsPanel(false)
                      setShowReportPanel(true)
                    }}
                    className="py-2 px-6 rounded-xl bg-[#017827] text-white text-sm font-bold hover:bg-[#0a9937] transition-colors"
                  >
                    <Trans>Report an Issue</Trans>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ticket Details Panel */}
      {showTicketDetailsPanel && selectedTicket && (
        <div
          className="seller-profile-view__panel"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowTicketDetailsPanel(false)
          }}
        >
          <div className="seller-profile-view__panel-content seller-profile-view__panel-content--large flex flex-col shadow-2xl">
            <div className="seller-profile-view__panel-header flex-shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowTicketDetailsPanel(false)}
                  className="p-1 -ml-1 hover:bg-[rgba(0,0,0,0.05)] rounded-full transition-colors"
                >
                  <ChevronRightIcon className="h-5 w-5 rotate-180" />
                </button>
                <div>
                  <h3 className="seller-profile-view__panel-title font-bold leading-tight"><Trans>Ticket Details</Trans></h3>
                  <p className="text-[10px] font-bold text-[#017827] tracking-wider uppercase">{selectedTicket.ticket.ticketId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTicketDetailsPanel(false)}
                className="seller-profile-view__panel-close"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="seller-profile-view__panel-body flex-1 overflow-hidden flex flex-col p-0">
              {/* Ticket Info Strip */}
              <div className="p-4 bg-[rgba(240,245,242,0.6)] border-b border-[rgba(1, 78, 23,0.08)] flex-shrink-0">
                <h4 className="text-sm font-bold text-[#172022] mb-2">{selectedTicket.ticket.subject}</h4>
                <div className="flex flex-wrap gap-2">
                  <span className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase",
                    selectedTicket.ticket.status === 'open' ? "bg-blue-100 text-blue-700" :
                      selectedTicket.ticket.status === 'in_progress' ? "bg-amber-100 text-amber-700" :
                        selectedTicket.ticket.status === 'resolved' ? "bg-[rgba(1,120,39,0.1)] text-[#017827]" :
                          "bg-gray-100 text-gray-700"
                  )}>
                    <Trans>{selectedTicket.ticket.status.replace('_', ' ')}</Trans>
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-[rgba(1, 78, 23,0.08)] text-[rgba(26,42,34,0.7)]">
                    <Trans>{selectedTicket.ticket.category}</Trans>
                  </span>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
                <div className="p-4 rounded-xl bg-[rgba(240,245,242,0.4)] border border-[rgba(1, 78, 23,0.06)] mb-6">
                  <p className="text-sm text-[rgba(26,42,34,0.8)] leading-relaxed">{selectedTicket.ticket.description}</p>
                  <p className="text-[10px] text-[rgba(26,42,34,0.4)] mt-2 font-bold">
                    {new Date(selectedTicket.ticket.createdAt).toLocaleString()}
                  </p>
                </div>

                {selectedTicket.messages?.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col max-w-[85%]",
                      msg.isFromAdmin ? "self-start items-start" : "self-end items-end ml-auto"
                    )}
                  >
                    <div className={cn(
                      "px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm",
                      msg.isFromAdmin
                        ? "bg-[#f8f9fa] border border-[rgba(0,0,0,0.05)] text-[#172022] rounded-tl-none font-medium"
                        : "bg-[#017827] text-white rounded-tr-none font-medium"
                    )}>
                      {msg.message}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 px-1">
                      <span className="text-[10px] font-bold text-[rgba(26,42,34,0.5)] uppercase tracking-tight">
                        {msg.isFromAdmin ? (selectedTicket.ticket.assignedTo || <Trans>Support Team</Trans>) : <Trans>You</Trans>}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-[rgba(26,42,34,0.2)]"></span>
                      <span className="text-[10px] text-[rgba(26,42,34,0.4)] font-bold">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {!msg.isFromAdmin && msg.readAt && (
                        <CheckIcon className="w-2.5 h-2.5 text-[#017827]" />
                      )}
                    </div>
                  </div>
                ))}

                {selectedTicket.ticket.status === 'resolved' && (
                  <div className="py-4 px-6 bg-[rgba(1,120,39,0.04)] border border-[rgba(1,120,39,0.12)] rounded-xl text-center">
                    <p className="text-sm font-bold text-[#015c1f] mb-1"><Trans>This ticket has been marked as resolved</Trans></p>
                    <p className="text-xs text-[#017827] opacity-80 font-medium"><Trans>If you still need help, you can send a message below to reopen it.</Trans></p>
                    {selectedTicket.ticket.resolution && (
                      <div className="mt-3 p-3 bg-white bg-opacity-50 rounded-lg text-sm italic text-[#014a19] border border-[rgba(1,120,39,0.12)] font-medium">
                        " {selectedTicket.ticket.resolution} "
                      </div>
                    )}
                  </div>
                )}

                {selectedTicket.ticket.status === 'closed' && (
                  <div className="py-8 px-6 bg-gray-50 border border-gray-200 rounded-xl text-center">
                    <p className="text-sm font-bold text-gray-700"><Trans>This ticket is closed and no longer accepting messages.</Trans></p>
                  </div>
                )}
              </div>

              {/* Input Area */}
              {selectedTicket.ticket.status !== 'closed' && (
                <div className="p-4 bg-white border-t border-[rgba(1, 78, 23,0.08)] flex-shrink-0">
                  <div className="flex items-end gap-2 bg-[#f8f9fa] border border-[rgba(1, 78, 23,0.1)] rounded-2xl p-2 focus-within:border-[#017827] transition-colors shadow-inner">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={translate('Type your message here...')}
                      className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 px-2 max-h-32 resize-none font-medium"
                      rows={1}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSendMessage()
                        }
                      }}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={isSendingMessage || !newMessage.trim()}
                      className="w-10 h-10 rounded-xl bg-[#017827] shadow-lg shadow-[#017827]/20 text-white flex items-center justify-center hover:bg-[#0a9937] transition-all active:scale-95 disabled:opacity-50 disabled:bg-gray-300 disabled:shadow-none"
                    >
                      {isSendingMessage ? (
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <ChevronRightIcon className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-[rgba(26,42,34,0.4)] mt-2 text-center font-bold italic">
                    <Trans>Our support team normally responds within a few hours.</Trans>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
