import { useState, useRef, useEffect, useCallback } from 'react'
import { Package } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { BUTTON_INTENT } from '../hooks/useButtonAction'
import { useVendorApi } from '../hooks/useVendorApi'
import { useVendorState } from '../context/VendorContext'

export function ButtonActionPanel({ action, isOpen, onClose, onAction, onShowNotification }) {
  const [uploadedFile, setUploadedFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  const [orderInfo, setOrderInfo] = useState(null)
  const fileInputRef = useRef(null)
  const { getOrderDetails } = useVendorApi()
  const { intent, title, data, buttonId } = action || {}

  // Initialize formData from fields if they exist
  const initializeFormData = useCallback(() => {
    if (intent === BUTTON_INTENT.UPDATION && data?.fields) {
      return data.fields.reduce((acc, field) => {
        acc[field.name] = field.value || ''
        return acc
      }, {})
    }
    return {}
  }, [intent, data])

  const [formData, setFormData] = useState(initializeFormData)



  // Fetch order details if orderId is present
  useEffect(() => {
    if (isOpen && data?.orderId && (buttonId === 'update-order-status' || buttonId === 'order-available' || buttonId === 'order-not-available')) {
      getOrderDetails(data.orderId).then((result) => {
        if (result.data?.order) {
          setOrderInfo(result.data.order)
        }
      }).catch(() => {
        setOrderInfo(null)
      })
    } else {
      setOrderInfo(null)
    }
  }, [isOpen, data?.orderId, buttonId, getOrderDetails])

  // Reset formData when action changes
  useEffect(() => {
    if (action && intent === BUTTON_INTENT.UPDATION) {
      const newFormData = initializeFormData()
      // Pre-fill bankAccountId if provided in data
      if (data.bankAccountId && !newFormData.bankAccountId) {
        newFormData.bankAccountId = data.bankAccountId
      }
      setFormData(newFormData)
    }
    setUploadedFile(null)
  }, [buttonId, action, intent, initializeFormData, data])

  const handleFormChange = (fieldName, value) => {
    setFormData((prev) => ({
      ...prev,
      [fieldName]: value,
    }))
    // Clear error for this field when user starts typing
    if (formErrors[fieldName]) {
      setFormErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[fieldName]
        return newErrors
      })
    }
  }

  const validateField = (field, value) => {
    if (field.required && !value) {
      return `${field.label} is required`
    }
    if (field.type === 'number' && value) {
      const numValue = parseFloat(value)
      if (isNaN(numValue)) {
        return `${field.label} must be a valid number`
      }
      if (field.min !== undefined && numValue < field.min) {
        return `${field.label} must be at least ${field.min}`
      }
      // Check max from field or from data (for dynamic max like availableBalance or creditUsed)
      const maxValue = field.max !== undefined ? field.max : (
        data?.availableBalance && field.name === 'amount' ? data.availableBalance :
          buttonId === 'repay-credit' && data?.creditUsed && field.name === 'amount' ? data.creditUsed :
            undefined
      )
      if (maxValue !== undefined && numValue > maxValue) {
        // For repay-credit, show exact max value (can be decimal)
        if (buttonId === 'repay-credit' && field.name === 'amount') {
          return `${field.label} must be at most ₹${maxValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
        }
        return `${field.label} must be at most ₹${Math.round(maxValue).toLocaleString('en-IN')}`
      }
    }
    if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return `${field.label} must be a valid email address`
    }
    return null
  }

  const handleFileUpload = (file) => {
    if (!file) return

    // Validate file type
    if (data.accept) {
      const acceptedTypes = data.accept.split(',').map((type) => type.trim())
      const fileExtension = '.' + file.name.split('.').pop().toLowerCase()
      const fileType = file.type

      const isAccepted = acceptedTypes.some(
        (acceptType) =>
          fileExtension === acceptType ||
          fileType === acceptType ||
          (acceptType.startsWith('.') && fileExtension === acceptType.toLowerCase()),
      )

      if (!isAccepted) {
        onShowNotification?.(
          `File type not supported. Accepted types: ${data.accept}`,
          'error',
        )
        return
      }
    }

    // Validate file size
    if (data.maxSize && file.size > data.maxSize) {
      onShowNotification?.(
        `File size exceeds ${data.maxSize / (1024 * 1024)}MB limit`,
        'error',
      )
      return
    }

    setUploadedFile(file)
    onShowNotification?.('File selected successfully', 'success')
  }

  const handleFileInputChange = (event) => {
    const file = event.target.files?.[0]
    handleFileUpload(file)
  }

  const handleDragOver = (event) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (event) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)

    const file = event.dataTransfer.files?.[0]
    handleFileUpload(file)
  }

  const handleSubmit = () => {
    if (intent === BUTTON_INTENT.UPDATION) {
      // For repay-credit, cap amount to creditUsed if exceeds (keep decimal values)
      let adjustedFormData = { ...formData }
      if (buttonId === 'repay-credit' && formData.amount) {
        const numAmount = parseFloat(formData.amount)

        // If exceeds max, set to exact max value (can be decimal)
        if (data?.creditUsed && numAmount > data.creditUsed) {
          adjustedFormData.amount = data.creditUsed.toString()
          // Update state immediately
          setFormData(adjustedFormData)
        }
      }

      // Validate all fields using adjusted form data
      const errors = {}
      let hasErrors = false

      data.fields?.forEach((field) => {
        const value = adjustedFormData[field.name] || field.value || ''
        const error = validateField(field, value)
        if (error) {
          errors[field.name] = error
          hasErrors = true
        }
      })

      if (hasErrors) {
        setFormErrors(errors)
        onShowNotification?.('Please fix the errors in the form', 'error')
        return
      }

      const submissionData = { ...adjustedFormData }
      // Preserve orderId and other metadata from action.data (passed via openPanel)
      // Always include these if they exist in action.data, even if they're in formData
      if (data?.orderId) {
        submissionData.orderId = data.orderId
      }
      if (data?.itemId) {
        submissionData.itemId = data.itemId
      }
      if (data?.currentStock !== undefined) {
        submissionData.currentStock = data.currentStock
      }
      // For revert action, ensure status is set to previous status
      if (data?.revert === true && buttonId === 'update-order-status' && data?.status) {
        submissionData.status = data.status
        submissionData.isRevert = true
      }
      // For withdrawal requests, include bankAccounts and availableBalance
      if (buttonId === 'request-withdrawal') {
        submissionData.availableBalance = data.availableBalance
        submissionData.bankAccounts = data.bankAccounts || []
        // Ensure bankAccountId is included
        if (!submissionData.bankAccountId && data.bankAccountId) {
          submissionData.bankAccountId = data.bankAccountId
        }
      }
      // For repayment requests, include credit information
      // Bank account will be filled in Razorpay interface
      if (buttonId === 'repay-credit') {
        submissionData.creditUsed = data.creditUsed
        submissionData.creditLimit = data.creditLimit
        // Keep amount as-is (can be decimal), but ensure it doesn't exceed creditUsed
        if (submissionData.amount && data?.creditUsed) {
          const amount = parseFloat(submissionData.amount)
          if (amount > data.creditUsed) {
            submissionData.amount = data.creditUsed
          }
        }
        // For repayment, let the handler manage the flow (payment intent, Razorpay, etc.)
        // Don't close panel or show success message here - handler will do that
        onAction?.({ type: 'update', data: submissionData, buttonId })
        return // Don't close panel or show default success for repayment
      }
      // Simulate API call
      onAction?.({ type: 'update', data: submissionData, buttonId })
      onShowNotification?.('Changes saved successfully', 'success')
      onClose()
    } else if (intent === BUTTON_INTENT.FILE_UPLOAD) {
      if (!uploadedFile) {
        onShowNotification?.('Please select a file to upload', 'error')
        return
      }
      // Simulate upload
      onAction?.({ type: 'upload', file: uploadedFile, buttonId })
      onShowNotification?.('File uploaded successfully', 'success')
      onClose()
    } else if (intent === BUTTON_INTENT.INSTANT_ACTION) {
      // Include data (like orderId) when confirming instant actions
      onAction?.({ type: 'confirm', buttonId, data: data || {} })
      onShowNotification?.('Action completed successfully', 'success')
      onClose()
    }
  }

  const handleCancel = () => {
    if (intent === BUTTON_INTENT.INSTANT_ACTION) {
      onAction?.({ type: 'cancel', buttonId })
      onShowNotification?.('Action cancelled', 'info')
    }
    onClose()
  }

  // Reset errors when panel closes
  useEffect(() => {
    if (!isOpen) {
      setFormErrors({})
      setUploadedFile(null)
      setIsDragging(false)
    }
  }, [isOpen])

  if (!action) return null

  const renderContent = () => {
    // Helper to render order customer info
    const renderOrderInfo = () => {
      if (!orderInfo && !data?.orderId) return null
      const order = orderInfo || {}
      const customerName = order.userId?.name || order.farmer || 'Unknown'
      const customerPhone = order.userId?.phone || order.customerPhone || 'N/A'

      return (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-4 w-4 text-gray-600" />
            <p className="text-sm font-semibold text-gray-900">
              Order #{order.orderNumber || order.id || data.orderId}
            </p>
          </div>
          <div className="text-xs text-gray-600 space-y-1">
            <p>Customer: {customerName}</p>
            <p>Contact: {customerPhone}</p>
          </div>
        </div>
      )
    }

    switch (intent) {
      case BUTTON_INTENT.UPDATION: {
        // Check if this is a revert action
        const isRevert = data?.revert === true && buttonId === 'update-order-status'
        const previousStatus = isRevert ? (orderInfo?.statusUpdateGracePeriod?.previousStatus || data?.status || '') : null

        // If it's a revert, show special revert confirmation UI
        if (isRevert && previousStatus) {
          const formatStatusLabel = (status) => {
            if (!status) return ''
            const normalized = status.toLowerCase()
            if (normalized === 'fully_paid') return 'Fully Paid'
            if (normalized === 'delivered') return 'Delivered'
            if (normalized === 'dispatched' || normalized === 'out_for_delivery') return 'Dispatched'
            if (normalized === 'accepted' || normalized === 'processing') return 'Accepted'
            if (normalized === 'awaiting' || normalized === 'pending') return 'Awaiting'
            return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')
          }

          return (
            <div className="vendor-action-panel__form">
              {renderOrderInfo()}

              {/* Previous Status Display */}
              <div className="vendor-action-panel__field">
                <label className="vendor-action-panel__label">
                  Previous Status
                  <span className="vendor-action-panel__required">*</span>
                </label>
                <div style={{
                  padding: '12px',
                  backgroundColor: '#F3F4F6',
                  border: '1px solid #D1D5DB',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#1F2937'
                }}>
                  {formatStatusLabel(previousStatus)}
                </div>
              </div>

              {/* Warning Message */}
              <div style={{
                padding: '12px',
                backgroundColor: '#FEF3C7',
                border: '1px solid #FCD34D',
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                <p style={{ fontSize: '14px', color: '#92400E', margin: 0, fontWeight: '500' }}>
                  ⚠️ Do you confirm to shift the order status to <strong>{formatStatusLabel(previousStatus)}</strong>?
                </p>
              </div>

              {/* Notes field (optional) */}
              {data.fields?.find(f => f.name === 'notes') && (
                <div className="vendor-action-panel__field">
                  <label className="vendor-action-panel__label">
                    {data.fields.find(f => f.name === 'notes').label}
                  </label>
                  <textarea
                    className={cn(
                      'vendor-action-panel__input',
                      formErrors.notes && 'is-error',
                    )}
                    value={formData.notes || ''}
                    onChange={(e) => handleFormChange('notes', e.target.value)}
                    placeholder="Enter notes (optional)"
                    rows={4}
                  />
                </div>
              )}

              <div className="vendor-action-panel__actions">
                <button type="button" onClick={onClose} className="vendor-action-panel__button is-secondary">
                  Cancel
                </button>
                <button type="button" onClick={handleSubmit} className="vendor-action-panel__button is-primary">
                  Confirm
                </button>
              </div>
            </div>
          )
        }

        // Normal update UI (existing logic)
        return (
          <div className="vendor-action-panel__form">
            {renderOrderInfo()}
            {data.fields?.map((field) => (
              <div key={field.name} className="vendor-action-panel__field">
                <label className="vendor-action-panel__label">
                  {field.label}
                  {field.required && <span className="vendor-action-panel__required">*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    className={cn(
                      'vendor-action-panel__input',
                      formErrors[field.name] && 'is-error',
                    )}
                    value={formData[field.name] || field.value || ''}
                    onChange={(e) => handleFormChange(field.name, e.target.value)}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    rows={4}
                  />
                ) : field.type === 'select' ? (
                  (() => {
                    // Get options from field or from additionalData (for dynamic options like bank accounts)
                    let filteredOptions = []
                    if (field.name === 'bankAccountId' && data.bankAccountOptions) {
                      filteredOptions = data.bankAccountOptions
                    } else if (field.options) {
                      filteredOptions = field.options
                    }

                    // For status field, filter to only show current and next status
                    if (field.name === 'status' && orderInfo) {
                      const normalizeStatus = (status) => {
                        if (!status) return 'awaiting'
                        const normalized = status.toLowerCase()
                        if (normalized === 'fully_paid') return 'fully_paid'
                        if (normalized === 'delivered') return 'delivered'
                        if (normalized === 'dispatched' || normalized === 'out_for_delivery') return 'dispatched'
                        if (normalized === 'accepted' || normalized === 'processing') return 'accepted'
                        if (normalized === 'awaiting' || normalized === 'pending') return 'awaiting'
                        return 'awaiting'
                      }

                      const currentStatus = normalizeStatus(orderInfo.status)
                      const paymentPreference = orderInfo.paymentPreference || 'partial'
                      const isInGracePeriod = orderInfo.statusUpdateGracePeriod?.isActive

                      // Define status flow based on payment preference
                      const statusFlow = paymentPreference === 'partial'
                        ? ['awaiting', 'accepted', 'dispatched', 'delivered', 'fully_paid']
                        : ['awaiting', 'accepted', 'dispatched', 'delivered']

                      const currentIndex = statusFlow.indexOf(currentStatus)

                      if (currentIndex >= 0 && !isInGracePeriod) {
                        // Only show current status and next status
                        const nextIndex = currentIndex + 1
                        const allowedStatuses = [
                          statusFlow[currentIndex], // Current status
                          ...(nextIndex < statusFlow.length ? [statusFlow[nextIndex]] : []) // Next status if exists
                        ]

                        filteredOptions = field.options.filter((option) => {
                          const optionValue = typeof option === 'object' ? option.value : option
                          return allowedStatuses.includes(optionValue)
                        })
                      } else if (isInGracePeriod) {
                        // During grace period, only show current status (for reverting)
                        filteredOptions = field.options.filter((option) => {
                          const optionValue = typeof option === 'object' ? option.value : option
                          return optionValue === currentStatus
                        })
                      }
                    }

                    return (
                      <select
                        className={cn(
                          'vendor-action-panel__input',
                          formErrors[field.name] && 'is-error',
                        )}
                        value={formData[field.name] || field.value || ''}
                        onChange={(e) => handleFormChange(field.name, e.target.value)}
                        required={field.required}
                      >
                        {filteredOptions.length === 0 ? (
                          <option value="">{field.placeholder || 'No options available'}</option>
                        ) : (
                          <>
                            {!formData[field.name] && !field.value && (
                              <option value="">{field.placeholder || 'Select an option'}</option>
                            )}
                            {filteredOptions.map((option) => {
                              // Handle both string and object options
                              const optionValue = typeof option === 'object' ? option.value : option
                              const optionLabel = typeof option === 'object' ? option.label : option.charAt(0).toUpperCase() + option.slice(1)

                              return (
                                <option key={optionValue} value={optionValue}>
                                  {optionLabel}
                                </option>
                              )
                            })}
                          </>
                        )}
                      </select>
                    )
                  })()
                ) : field.type === 'file' ? (
                  <div className="vendor-action-panel__file-field">
                    <input
                      ref={field.name === 'attachment' ? fileInputRef : null}
                      type="file"
                      accept={field.accept || '.pdf,.jpg,.jpeg,.png,.doc,.docx'}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          handleFormChange(field.name, file.name)
                          handleFormChange(`${field.name}_file`, file)
                        }
                      }}
                      className="vendor-action-panel__file-input"
                      style={{ display: 'none' }}
                    />
                    {formData[`${field.name}_file`] ? (
                      <div className="vendor-action-panel__file-preview">
                        <div className="vendor-action-panel__file-info">
                          <span className="vendor-action-panel__file-icon">📄</span>
                          <div className="vendor-action-panel__file-details">
                            <p className="vendor-action-panel__file-name">{formData[field.name]}</p>
                            <p className="vendor-action-panel__file-size">
                              {(formData[`${field.name}_file`].size / 1024).toFixed(2)} KB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              handleFormChange(field.name, '')
                              handleFormChange(`${field.name}_file`, null)
                            }}
                            className="vendor-action-panel__file-remove"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const input = field.name === 'attachment' ? fileInputRef.current : document.createElement('input')
                          input.type = 'file'
                          input.accept = field.accept || '.pdf,.jpg,.jpeg,.png,.doc,.docx'
                          input.onchange = (e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              handleFormChange(field.name, file.name)
                              handleFormChange(`${field.name}_file`, file)
                            }
                          }
                          input.click()
                        }}
                        className="vendor-action-panel__file-select-button"
                      >
                        Choose File
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <input
                      type={field.type}
                      className={cn(
                        'vendor-action-panel__input',
                        formErrors[field.name] && 'is-error',
                        field.type === 'number' && 'vendor-action-panel__input--no-spinner',
                      )}
                      value={formData[field.name] || field.value || ''}
                      onChange={(e) => {
                        const value = e.target.value
                        // For withdrawal amount, prevent entering more than available balance
                        if (field.name === 'amount' && data?.availableBalance) {
                          const numValue = parseFloat(value)
                          if (!isNaN(numValue) && numValue > data.availableBalance) {
                            // Don't update if exceeds available balance
                            return
                          }
                        }
                        // For repayment amount, automatically cap to creditUsed (keep decimal values)
                        if (field.name === 'amount' && buttonId === 'repay-credit' && data?.creditUsed) {
                          const numValue = parseFloat(value)
                          if (!isNaN(numValue) && numValue > data.creditUsed) {
                            // If value exceeds max, set to exact max value (can be decimal)
                            handleFormChange(field.name, data.creditUsed.toString())
                            return
                          }
                        }
                        handleFormChange(field.name, value)
                      }}
                      placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                      min={field.min}
                      max={field.max !== undefined ? field.max : (
                        data?.availableBalance && field.name === 'amount' ? data.availableBalance :
                          buttonId === 'repay-credit' && data?.creditUsed && field.name === 'amount' ? data.creditUsed :
                            undefined
                      )}
                      required={field.required}
                    />
                    {field.name === 'amount' && data?.availableBalance && (
                      <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                        Available balance: ₹{Math.round(data.availableBalance).toLocaleString('en-IN')}
                      </p>
                    )}
                    {field.name === 'amount' && buttonId === 'repay-credit' && data?.creditUsed && (
                      <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                        Maximum: ₹{data.creditUsed.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (Outstanding credit)
                      </p>
                    )}
                  </>
                )}
                {formErrors[field.name] && (
                  <span className="vendor-action-panel__error">{formErrors[field.name]}</span>
                )}
              </div>
            ))}
            <div className="vendor-action-panel__actions">
              <button type="button" onClick={onClose} className="vendor-action-panel__button is-secondary">
                Cancel
              </button>
              <button type="button" onClick={handleSubmit} className="vendor-action-panel__button is-primary">
                {data.type === 'admin_request' ? 'Send Request' :
                  buttonId === 'repay-credit' ? 'Repay' :
                    'Update'}
              </button>
            </div>
          </div>
        )

      }
      case BUTTON_INTENT.INFORMATION_DISPLAY:
        return <InformationDisplayContent data={data} buttonId={buttonId} />

      case BUTTON_INTENT.VIEW_ONLY:
        return <ViewOnlyContent data={data} buttonId={buttonId} />

      case BUTTON_INTENT.FILE_UPLOAD:
        return (
          <div className="vendor-action-panel__upload">
            <input
              ref={fileInputRef}
              type="file"
              accept={data.accept}
              onChange={handleFileInputChange}
              className="vendor-action-panel__file-input"
              style={{ display: 'none' }}
            />
            {!uploadedFile ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  'vendor-action-panel__upload-zone',
                  isDragging && 'is-dragging',
                )}
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="vendor-action-panel__upload-button"
                >
                  <span className="vendor-action-panel__upload-icon">📁</span>
                  <span>Choose File or Drag & Drop</span>
                  <span className="vendor-action-panel__upload-hint">
                    {data.accept ? `Accepted: ${data.accept}` : 'Select file'}
                    {data.maxSize ? ` (Max: ${data.maxSize / (1024 * 1024)}MB)` : ''}
                  </span>
                </button>
              </div>
            ) : (
              <div className="vendor-action-panel__file-preview">
                <div className="vendor-action-panel__file-info">
                  <span className="vendor-action-panel__file-icon">📄</span>
                  <div className="vendor-action-panel__file-details">
                    <p className="vendor-action-panel__file-name">{uploadedFile.name}</p>
                    <p className="vendor-action-panel__file-size">
                      {(uploadedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadedFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    className="vendor-action-panel__file-remove"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
            <div className="vendor-action-panel__actions">
              <button type="button" onClick={onClose} className="vendor-action-panel__button is-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!uploadedFile}
                className="vendor-action-panel__button is-primary"
              >
                Upload
              </button>
            </div>
          </div>
        )

      case BUTTON_INTENT.INSTANT_ACTION:
        return (
          <div className="vendor-action-panel__confirmation">
            {renderOrderInfo()}
            <p className="vendor-action-panel__confirmation-message">{data.message}</p>
            <div className="vendor-action-panel__actions">
              <button type="button" onClick={handleCancel} className="vendor-action-panel__button is-secondary">
                {data.cancelLabel || 'Cancel'}
              </button>
              <button type="button" onClick={handleSubmit} className="vendor-action-panel__button is-primary">
                {data.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        )

      default:
        return <div>Unknown action type</div>
    }
  }

  return (
    <div className={cn('vendor-activity-sheet', isOpen && 'is-open')}>
      <div className={cn('vendor-activity-sheet__overlay', isOpen && 'is-open')} onClick={onClose} />
      <div className={cn('vendor-activity-sheet__panel', isOpen && 'is-open')}>
        <div className="vendor-activity-sheet__header">
          <h4>{data?.revert === true && buttonId === 'update-order-status' ? 'Revert Current Status' : title}</h4>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="vendor-activity-sheet__body">{renderContent()}</div>
      </div>
    </div>
  )
}

// Information Display Content Component
function InformationDisplayContent({ data, buttonId }) {
  const { dashboard } = useVendorState()
  const { getCreditInfo, getWithdrawals, getInventoryStats, getRepaymentHistory } = useVendorApi()
  const [creditData, setCreditData] = useState(null)
  const [withdrawalsData, setWithdrawalsData] = useState(null)
  const [inventoryStatsData, setInventoryStatsData] = useState(null)
  const [repaymentHistory, setRepaymentHistory] = useState([])
  const [loading, setLoading] = useState(false)

  // Fetch real data when modal opens
  useEffect(() => {
    if (data.type === 'credit_info' || data.type === 'credit_details') {
      setLoading(true)
      Promise.all([
        getCreditInfo(),
        getRepaymentHistory({ page: 1, limit: 10, status: 'completed' })
      ]).then(([creditResult, repaymentResult]) => {
        if (creditResult.data) {
          setCreditData(creditResult.data)
        }
        if (repaymentResult.data?.repayments) {
          setRepaymentHistory(repaymentResult.data.repayments)
        }
        setLoading(false)
      }).catch(() => setLoading(false))
    } else if (data.type === 'payouts') {
      setLoading(true)
      getWithdrawals({ page: 1, limit: 10 }).then((result) => {
        if (result.data?.withdrawals) {
          setWithdrawalsData(result.data.withdrawals)
        }
        setLoading(false)
      }).catch(() => setLoading(false))
    } else if (data.type === 'reorder' || data.type === 'stock_report') {
      setLoading(true)
      getInventoryStats().then((result) => {
        if (result.data) {
          setInventoryStatsData(result.data)
        }
        setLoading(false)
      }).catch(() => setLoading(false))
    }
  }, [data.type, getCreditInfo, getWithdrawals, getInventoryStats])

  const renderContentByType = () => {
    switch (data.type) {
      case 'credit_info':
      case 'credit_details': {
        // Use real credit data from backend or dashboard
        const creditInfo = creditData?.credit || dashboard?.credit?.credit || {}
        const creditStatus = creditData?.status || dashboard?.credit?.status || {}
        const creditUsed = creditInfo.used || dashboard?.overview?.credit?.used || 0
        const penalty = creditStatus.penalty || dashboard?.overview?.credit?.penalty || 0
        const dueDate = creditInfo.dueDate || dashboard?.overview?.credit?.dueDate

        const formatCredit = (value) => {
          if (!value || value === 0) return '₹0'
          return value >= 100000 ? `₹${(value / 100000).toFixed(1)}L` : `₹${Math.round(value).toLocaleString('en-IN')}`
        }

        const formatDate = (date) => {
          if (!date) return 'Not set'
          return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        }

        if (loading) {
          return <div className="vendor-info-display"><p>Loading credit information...</p></div>
        }

        // Calculate total repaid and repayment count
        const totalRepaid = repaymentHistory.reduce((sum, r) => sum + (r.amount || 0), 0)
        const repaymentCount = repaymentHistory.filter(r => r.status === 'completed').length

        // Get last repayment date
        const lastRepayment = repaymentHistory
          .filter(r => r.status === 'completed')
          .sort((a, b) => {
            const dateA = new Date(a.paidAt || a.transactionDate || a.createdAt || 0)
            const dateB = new Date(b.paidAt || b.transactionDate || b.createdAt || 0)
            return dateB - dateA
          })[0]

        return (
          <div className="vendor-info-display">
            <div className="vendor-info-display__section">
              <h5 className="vendor-info-display__section-title">Credit Summary</h5>
              <div className="vendor-info-display__metrics">
                <div className="vendor-info-display__metric">
                  <span className="vendor-info-display__metric-label">Outstanding Credit</span>
                  <span className="vendor-info-display__metric-value">{formatCredit(creditUsed)}</span>
                </div>
                <div className="vendor-info-display__metric">
                  <span className="vendor-info-display__metric-label">To Repay</span>
                  <span className="vendor-info-display__metric-value">{formatCredit(creditUsed)}</span>
                </div>
                {totalRepaid > 0 && (
                  <div className="vendor-info-display__metric">
                    <span className="vendor-info-display__metric-label">Total Repaid</span>
                    <span className="vendor-info-display__metric-value">{formatCredit(totalRepaid)}</span>
                  </div>
                )}
                {repaymentCount > 0 && (
                  <div className="vendor-info-display__metric">
                    <span className="vendor-info-display__metric-label">Repayment Count</span>
                    <span className="vendor-info-display__metric-value">{repaymentCount}</span>
                  </div>
                )}
                <div className="vendor-info-display__metric">
                  <span className="vendor-info-display__metric-label">Due Date</span>
                  <span className="vendor-info-display__metric-value">{formatDate(dueDate)}</span>
                </div>
                {lastRepayment && (
                  <div className="vendor-info-display__metric">
                    <span className="vendor-info-display__metric-label">Last Repayment</span>
                    <span className="vendor-info-display__metric-value">{formatDate(lastRepayment.paidAt || lastRepayment.transactionDate || lastRepayment.createdAt)}</span>
                  </div>
                )}
              </div>
              <div className="vendor-info-display__status">
                <span className="vendor-info-display__status-badge">{penalty === 0 ? 'No penalty' : `₹${penalty.toLocaleString('en-IN')}`}</span>
              </div>
            </div>

            {repaymentHistory.length > 0 && (
              <div className="vendor-info-display__section">
                <h5 className="vendor-info-display__section-title">Recent Repayments</h5>
                <div className="vendor-info-display__list">
                  {repaymentHistory.slice(0, 5).map((repayment, index) => {
                    const repaymentDate = repayment.paidAt || repayment.transactionDate || repayment.createdAt
                    const repaymentId = repayment.repaymentId || `REP-${(repayment._id || repayment.id).toString().slice(-4)}`
                    return (
                      <div key={repayment._id || repayment.id || index} className="vendor-info-display__item vendor-info-display__item--repayment">
                        <span className="vendor-info-display__item-id">{repaymentId}</span>
                        <span className="vendor-info-display__item-amount">-₹{(repayment.amount || 0).toLocaleString('en-IN')}</span>
                        <span className="vendor-info-display__item-status">{repayment.status === 'completed' ? 'Completed' : repayment.status}</span>
                        <span className="vendor-info-display__item-date">{formatDate(repaymentDate)}</span>
                        {repayment.penaltyAmount > 0 && (
                          <span className="vendor-info-display__item-penalty">
                            (Penalty: ₹{repayment.penaltyAmount.toLocaleString('en-IN')})
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )

      }
      case 'payouts': {
        const formatCurrency = (amount) => {
          if (!amount) return '₹0'
          return `₹${Math.round(amount).toLocaleString('en-IN')}`
        }

        const formatPayoutDate = (date) => {
          if (!date) return 'N/A'
          return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        }

        if (loading) {
          return <div className="vendor-info-display"><p>Loading payouts...</p></div>
        }

        const withdrawals = withdrawalsData || []

        return (
          <div className="vendor-info-display">
            <div className="vendor-info-display__section">
              <h5 className="vendor-info-display__section-title">Recent Payouts</h5>
              <div className="vendor-info-display__list">
                {withdrawals.length > 0 ? withdrawals.map((withdrawal, index) => {
                  const status = withdrawal.status === 'approved' ? 'Completed' : withdrawal.status === 'pending' ? 'Pending' : withdrawal.status === 'rejected' ? 'Rejected' : withdrawal.status
                  return (
                    <div key={withdrawal._id || withdrawal.id || index} className="vendor-info-display__item">
                      <div>
                        <p className="vendor-info-display__item-label">Date</p>
                        <p className="vendor-info-display__item-value">{formatPayoutDate(withdrawal.requestedAt || withdrawal.createdAt)}</p>
                      </div>
                      <div>
                        <p className="vendor-info-display__item-label">Amount</p>
                        <p className="vendor-info-display__item-value">{formatCurrency(withdrawal.amount)}</p>
                      </div>
                      <div>
                        <p className="vendor-info-display__item-label">Status</p>
                        <span className={cn('vendor-info-display__item-badge', status === 'Completed' || status === 'approved' ? 'is-success' : status === 'Pending' || status === 'pending' ? 'is-pending' : 'is-error')}>
                          {status}
                        </span>
                      </div>
                    </div>
                  )
                }) : (
                  <div className="vendor-info-display__item">
                    <p className="text-sm text-gray-500">No withdrawals yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }

      case 'reorder': {
        if (loading) {
          return <div className="vendor-info-display"><p>Loading reorder information...</p></div>
        }

        // Use real inventory stats from backend or dashboard
        const lowStockCount = inventoryStatsData?.lowStockCount || dashboard?.overview?.inventory?.lowStockCount || 0
        const criticalStockCount = inventoryStatsData?.criticalStockCount || dashboard?.overview?.inventory?.criticalStockCount || 0

        return (
          <div className="vendor-info-display">
            <div className="vendor-info-display__section">
              <h5 className="vendor-info-display__section-title">Reorder Information</h5>
              <div className="vendor-info-display__content">
                <p>Items requiring reorder based on current stock levels and safety buffers.</p>
                <div className="vendor-info-display__metrics">
                  <div className="vendor-info-display__metric">
                    <span className="vendor-info-display__metric-label">Critical Items</span>
                    <span className="vendor-info-display__metric-value">{criticalStockCount}</span>
                  </div>
                  <div className="vendor-info-display__metric">
                    <span className="vendor-info-display__metric-label">Low Stock Items</span>
                    <span className="vendor-info-display__metric-value">{lowStockCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }

      case 'stock_report': {
        if (loading) {
          return <div className="vendor-info-display"><p>Loading stock report...</p></div>
        }

        // Use real inventory stats from backend or dashboard
        const totalProducts = inventoryStatsData?.totalProducts || dashboard?.overview?.inventory?.totalProducts || 0
        const inStockCount = inventoryStatsData?.inStockCount || dashboard?.overview?.inventory?.inStockCount || 0
        const averageStockHealth = totalProducts > 0 ? Math.round((inStockCount / totalProducts) * 100) : 0
        const reorderPoints = inventoryStatsData?.reorderPoints || dashboard?.overview?.inventory?.lowStockCount || 0

        return (
          <div className="vendor-info-display">
            <div className="vendor-info-display__section">
              <h5 className="vendor-info-display__section-title">Stock Report Summary</h5>
              <div className="vendor-info-display__metrics">
                <div className="vendor-info-display__metric">
                  <span className="vendor-info-display__metric-label">Total SKUs</span>
                  <span className="vendor-info-display__metric-value">{totalProducts}</span>
                </div>
                <div className="vendor-info-display__metric">
                  <span className="vendor-info-display__metric-label">Average Stock Health</span>
                  <span className="vendor-info-display__metric-value">{averageStockHealth}%</span>
                </div>
                <div className="vendor-info-display__metric">
                  <span className="vendor-info-display__metric-label">Reorder Points</span>
                  <span className="vendor-info-display__metric-value">{reorderPoints}</span>
                </div>
              </div>
            </div>
          </div>
        )
      }

      default:
        return <div className="vendor-info-display">Information will be displayed here.</div>
    }
  }

  return renderContentByType()
}

// View Only Content Component
function ViewOnlyContent({ data, buttonId }) {
  const renderContentByType = () => {
    switch (data.type) {
      case 'sla_policy':
        return (
          <div className="vendor-view-only">
            <div className="vendor-view-only__section">
              <h5 className="vendor-view-only__section-title">SLA Policy</h5>
              <div className="vendor-view-only__content">
                <div className="vendor-view-only__policy-item">
                  <h6>Order Confirmation</h6>
                  <p>Vendors must confirm order availability within 2 hours of order placement.</p>
                </div>
                <div className="vendor-view-only__policy-item">
                  <h6>Processing Time</h6>
                  <p>Orders should be processed and ready for dispatch within 24 hours of confirmation.</p>
                </div>
                <div className="vendor-view-only__policy-item">
                  <h6>Delivery Commitment</h6>
                  <p>On-time delivery rate should maintain above 90% for optimal performance rating.</p>
                </div>
                <div className="vendor-view-only__policy-item">
                  <h6>Penalties</h6>
                  <p>Late confirmations or deliveries may result in performance penalties and credit limit adjustments.</p>
                </div>
              </div>
            </div>
          </div>
        )

      case 'suppliers':
        return (
          <div className="vendor-view-only">
            <div className="vendor-view-only__section">
              <h5 className="vendor-view-only__section-title">Supplier List</h5>
              <div className="vendor-view-only__list">
                {['Admin Hub', 'Central Warehouse', 'Regional Distributor'].map((supplier, index) => (
                  <div key={index} className="vendor-view-only__item">
                    <div>
                      <p className="vendor-view-only__item-name">{supplier}</p>
                      <p className="vendor-view-only__item-meta">Primary supplier • Fast delivery</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )

      case 'profile':
        return (
          <div className="vendor-view-only">
            <div className="vendor-view-only__section">
              <h5 className="vendor-view-only__section-title">Profile & Settings</h5>
              <div className="vendor-view-only__content">
                <div className="vendor-view-only__profile-item">
                  <span className="vendor-view-only__profile-label">Account Status</span>
                  <span className="vendor-view-only__profile-value is-success">Active</span>
                </div>
                <div className="vendor-view-only__profile-item">
                  <span className="vendor-view-only__profile-label">KYC Status</span>
                  <span className="vendor-view-only__profile-value is-success">Verified</span>
                </div>
                <div className="vendor-view-only__profile-item">
                  <span className="vendor-view-only__profile-label">Documentation</span>
                  <span className="vendor-view-only__profile-value">Up to date</span>
                </div>
              </div>
            </div>
          </div>
        )

      default:
        return <div className="vendor-view-only">View-only content will be displayed here.</div>
    }
  }

  return renderContentByType()
}

