import { useState, useEffect } from 'react'
import {
    Search,
    Filter,
    MoreVertical,
    MessageSquare,
    User,
    Store,
    Clock,
    CheckCircle,
    AlertCircle,
    Send,
    ChevronLeft,
    X,
    Plus,
    ShieldCheck
} from 'lucide-react'
import { cn } from '../../../lib/cn'
import * as adminApi from '../services/adminApi'
import { useToast } from '../components/ToastNotification'

export function SupportPage() {
    const [tickets, setTickets] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedTicket, setSelectedTicket] = useState(null)
    const [reply, setReply] = useState('')
    const [isReplying, setIsReplying] = useState(false)
    const { success, error } = useToast()

    // Status mapping
    const statusConfig = {
        open: { label: 'Open', color: 'bg-blue-100 text-blue-700', icon: AlertCircle },
        in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700', icon: Clock },
        resolved: { label: 'Resolved', color: 'bg-[rgba(1,120,39,0.1)] text-[#017827]', icon: CheckCircle },
        closed: { label: 'Closed', color: 'bg-gray-100 text-gray-700', icon: X }
    }

    // Priority mapping
    const priorityConfig = {
        low: { label: 'Low', color: 'bg-gray-50 text-gray-500' },
        medium: { label: 'Medium', color: 'bg-blue-50 text-blue-500' },
        high: { label: 'High', color: 'bg-red-50 text-red-500' },
        urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700' }
    }

    useEffect(() => {
        fetchTickets()
    }, [])

    const fetchTickets = async () => {
        setLoading(true)
        try {
            const params = {}
            if (activeTab !== 'all') params.status = activeTab

            const result = await adminApi.getSupportTickets(params)
            if (result.success) {
                setTickets(result.data.tickets || [])
            }
        } catch (err) {
            error('Failed to fetch tickets')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchTickets()
    }, [activeTab])

    const handleSelectTicket = async (ticket) => {
        try {
            const result = await adminApi.getSupportTicketDetails(ticket.id)
            if (result.success) {
                setSelectedTicket(result.data)
            }
        } catch (err) {
            error('Failed to fetch ticket details')
        }
    }

    const handleSendReply = async () => {
        if (!reply.trim() || !selectedTicket) return
        setIsReplying(true)
        try {
            const result = await adminApi.replyToSupportTicket(selectedTicket.ticket.id, {
                message: reply.trim(),
                status: selectedTicket.ticket.status === 'open' ? 'in_progress' : undefined
            })
            if (result.success) {
                setReply('')
                success('Reply sent successfully')
                // Refresh ticket details
                handleSelectTicket(selectedTicket.ticket)
            }
        } catch (err) {
            error('Failed to send reply')
        } finally {
            setIsReplying(false)
        }
    }

    const handleUpdateStatus = async (status) => {
        if (!selectedTicket) return
        try {
            const result = await adminApi.updateSupportTicketStatus(selectedTicket.ticket.id, { status })
            if (result.success) {
                success(`Status updated to ${status}`)
                handleSelectTicket(selectedTicket.ticket)
                fetchTickets()
            }
        } catch (err) {
            error('Failed to update status')
        }
    }

    const filteredTickets = tickets.filter(t =>
        t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.ticketId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.userId && t.userId.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    return (
        <div className="flex h-[calc(100vh-140px)] bg-gray-50/50 rounded-2xl border border-gray-200 overflow-hidden">
            {/* Left Sidebar - Tickets List */}
            <div className="w-[380px] flex-shrink-0 flex flex-col border-r border-gray-200 bg-white">
                {/* Header & Search */}
                <div className="p-4 border-b border-gray-200 space-y-3">
                    <h2 className="text-lg font-bold text-gray-900">Support Tickets</h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search ID, subject or user..."
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Status Tabs */}
                <div className="flex px-4 pt-2 gap-1 border-b border-gray-200 overflow-x-auto scrollbar-none">
                    {['all', 'open', 'in_progress', 'resolved', 'closed'].map(status => (
                        <button
                            key={status}
                            onClick={() => setActiveTab(status)}
                            className={cn(
                                "px-3 py-2 text-xs font-bold whitespace-nowrap border-b-2 transition-all",
                                activeTab === status
                                    ? "border-blue-600 text-blue-600"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200"
                            )}
                        >
                            {status === 'all' ? 'All' : status.replace('_', ' ').toUpperCase()}
                        </button>
                    ))}
                </div>

                {/* Tickets List */}
                <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-40">
                            <div className="w-8 h-8 border-3 border-gray-100 border-t-blue-600 rounded-full animate-spin"></div>
                            <p className="mt-3 text-xs text-gray-400 font-medium">Loading tickets...</p>
                        </div>
                    ) : filteredTickets.length > 0 ? (
                        filteredTickets.map(ticket => (
                            <button
                                key={ticket.id}
                                onClick={() => handleSelectTicket(ticket)}
                                className={cn(
                                    "w-full p-4 flex flex-col text-left transition-all hover:bg-gray-50/80 group",
                                    selectedTicket?.ticket?.id === ticket.id && "bg-blue-50/50 ring-1 ring-inset ring-blue-100"
                                )}
                            >
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10px] font-bold text-gray-400 group-hover:text-blue-600 transition-colors uppercase tracking-wider">{ticket.ticketId}</span>
                                    <span className={cn(
                                        "px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold uppercase tracking-tight",
                                        statusConfig[ticket.status].color
                                    )}>
                                        {statusConfig[ticket.status].label}
                                    </span>
                                </div>
                                <h3 className="text-sm font-bold text-gray-900 mb-2 line-clamp-1 group-hover:text-blue-700 transition-colors">{ticket.subject}</h3>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5">
                                        {ticket.userType === 'user' ? (
                                            <div className="p-1 rounded bg-blue-50 border border-blue-100">
                                                <User className="h-3 w-3 text-blue-600" />
                                            </div>
                                        ) : (
                                            <div className="p-1 rounded bg-[rgba(1,120,39,0.04)] border border-[rgba(1,120,39,0.12)]">
                                                <Store className="h-3 w-3 text-[#017827]" />
                                            </div>
                                        )}
                                        <span className="text-[11px] font-bold text-gray-500 uppercase">{ticket.userType}</span>
                                    </div>
                                    <span className="text-[11px] font-medium text-gray-400">
                                        {new Date(ticket.lastActivityAt).toLocaleDateString()}
                                    </span>
                                    {ticket.unreadByAdmin && (
                                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse ml-auto"></span>
                                    )}
                                </div>
                            </button>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center p-8 text-center h-60">
                            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-4 border border-gray-100">
                                <MessageSquare className="h-6 w-6 text-gray-300" />
                            </div>
                            <h4 className="text-sm font-bold text-gray-900">No tickets found</h4>
                            <p className="mt-1 text-xs text-gray-500">Try adjusting your filters or search terms.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content - Selected Ticket Detail */}
            <div className="flex-1 flex flex-col bg-white">
                {selectedTicket ? (
                    <>
                        {/* Detail Header */}
                        <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-white sticky top-0 z-10">
                            <div className="flex items-start gap-4">
                                <div className={cn(
                                    "p-3 rounded-2xl",
                                    selectedTicket.ticket.userType === 'user' ? "bg-blue-50 text-blue-600" : "bg-[rgba(1,120,39,0.04)] text-[#017827]"
                                )}>
                                    {selectedTicket.ticket.userType === 'user' ? <User className="h-6 w-6" /> : <Store className="h-6 w-6" />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h2 className="text-lg font-bold text-gray-900">{selectedTicket.ticket.subject}</h2>
                                        <span className={cn(
                                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                            statusConfig[selectedTicket.ticket.status].color
                                        )}>
                                            {statusConfig[selectedTicket.ticket.status].label}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-gray-500">
                                        <span className="font-bold text-blue-600">{selectedTicket.ticket.ticketId}</span>
                                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                        <span>Created on {new Date(selectedTicket.ticket.createdAt).toLocaleString()}</span>
                                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                        <span className="font-medium">Category: <span className="text-gray-900">{selectedTicket.ticket.category}</span></span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="relative group">
                                    <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-all">
                                        Action
                                        <ChevronDown className="h-3 w-3" />
                                    </button>
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-xl shadow-gray-200/50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 overflow-hidden">
                                        <button
                                            onClick={() => handleUpdateStatus('in_progress')}
                                            className="w-full px-4 py-2.5 text-left text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors border-b border-gray-50"
                                        >
                                            Mark as In Progress
                                        </button>
                                        <button
                                            onClick={() => handleUpdateStatus('resolved')}
                                            className="w-full px-4 py-2.5 text-left text-xs font-bold text-gray-700 hover:bg-[rgba(1,120,39,0.05)] hover:text-[#017827] transition-colors border-b border-gray-50"
                                        >
                                            Mark as Resolved
                                        </button>
                                        <button
                                            onClick={() => handleUpdateStatus('closed')}
                                            className="w-full px-4 py-2.5 text-left text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
                                        >
                                            Close Ticket
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Conversation Area */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30">
                            {/* Initial Issue Description */}
                            <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex-shrink-0 flex items-center justify-center border-2 border-white shadow-sm">
                                    <User className="h-5 w-5 text-gray-500" />
                                </div>
                                <div className="flex-1">
                                    <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none p-5 shadow-sm">
                                        <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Initial Description</h4>
                                        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{selectedTicket.ticket.description}</p>
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-400 mt-2 block ml-1 uppercase">
                                        {new Date(selectedTicket.ticket.createdAt).toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* Messages Thread */}
                            {selectedTicket.messages?.map((msg, idx) => (
                                <div key={msg.id} className={cn(
                                    "flex gap-4",
                                    msg.isFromAdmin ? "flex-row-reverse" : "flex-row"
                                )}>
                                    <div className={cn(
                                        "w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center border-2 border-white shadow-sm",
                                        msg.isFromAdmin
                                            ? "bg-gradient-to-br from-blue-600 to-blue-700"
                                            : "bg-gradient-to-br from-gray-100 to-gray-200"
                                    )}>
                                        {msg.isFromAdmin
                                            ? <ShieldCheck className="h-5 w-5 text-white" />
                                            : <User className="h-5 w-5 text-gray-500" />
                                        }
                                    </div>
                                    <div className={cn(
                                        "flex-1 max-w-[70%]",
                                        msg.isFromAdmin ? "items-end" : "items-start"
                                    )}>
                                        <div className={cn(
                                            "p-4 rounded-2xl shadow-sm text-sm whitespace-pre-wrap leading-relaxed",
                                            msg.isFromAdmin
                                                ? "bg-blue-600 text-white rounded-tr-none"
                                                : "bg-white border border-gray-200 text-gray-800 rounded-tl-none"
                                        )}>
                                            {msg.message}
                                        </div>
                                        <div className={cn(
                                            "flex items-center gap-2 mt-2 px-1",
                                            msg.isFromAdmin ? "justify-end" : "justify-start"
                                        )}>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                                                {msg.isFromAdmin ? 'Support Admin' : msg.senderName}
                                            </span>
                                            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                            <span className="text-[10px] font-medium text-gray-400">
                                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Reply Input Area */}
                        <div className="p-5 border-t border-gray-200 bg-white">
                            <div className="flex flex-col gap-3">
                                <div className="relative">
                                    <textarea
                                        rows={4}
                                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all resize-none shadow-inner"
                                        placeholder="Type your reply here..."
                                        value={reply}
                                        onChange={(e) => setReply(e.target.value)}
                                        disabled={isReplying || selectedTicket.ticket.status === 'closed'}
                                    />
                                    {selectedTicket.ticket.status === 'closed' && (
                                        <div className="absolute inset-0 bg-gray-50/50 backdrop-blur-[1px] flex items-center justify-center rounded-2xl">
                                            <span className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-500 shadow-sm">
                                                This ticket is closed
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleUpdateStatus('resolved')}
                                            disabled={selectedTicket.ticket.status === 'resolved' || selectedTicket.ticket.status === 'closed'}
                                            className="px-4 py-2 rounded-xl bg-[rgba(1,120,39,0.04)] text-[#017827] text-xs font-bold border border-[rgba(1,120,39,0.12)] hover:bg-[rgba(1,120,39,0.1)] transition-colors disabled:opacity-50"
                                        >
                                            Resolve Ticket
                                        </button>
                                        <button
                                            onClick={() => handleUpdateStatus('closed')}
                                            disabled={selectedTicket.ticket.status === 'closed'}
                                            className="px-4 py-2 rounded-xl bg-red-50 text-red-700 text-xs font-bold border border-red-100 hover:bg-red-100 transition-colors disabled:opacity-50"
                                        >
                                            Close Ticket
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleSendReply}
                                        disabled={!reply.trim() || isReplying || selectedTicket.ticket.status === 'closed'}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-200/50 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
                                    >
                                        {isReplying ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        ) : (
                                            <>
                                                <Send className="h-4 w-4" />
                                                Send Reply
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/30 p-12 text-center">
                        <div className="w-24 h-24 rounded-full bg-white shadow-xl shadow-gray-200/50 flex items-center justify-center mb-8 border border-gray-100">
                            <MessageSquare className="h-10 w-10 text-blue-200" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">Select a Ticket</h2>
                        <p className="text-sm text-gray-500 max-w-sm">
                            Click on a ticket from the list to view the conversation and respond to the issue.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}

function ChevronDown(props) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
        >
            <path d="m6 9 6 6 6-6" />
        </svg>
    )
}
