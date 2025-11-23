import React, { useState, useEffect } from 'react';
import { WithdrawalRequest, UserProfile, DepositTransaction } from '../services/supabaseClient';
import { Loader2, X, Wallet, User, History, Shield, Ban } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

// Hardcoded admin credentials as requested
const ADMIN_USERNAME = 'kingos69';
const ADMIN_PASSWORD = 'tnt007tnt007';
const ADMIN_SESSION_KEY = 'pump_admin_session';

type AdminTab = 'withdrawals' | 'users' | 'deposits';

interface TradingPositionHistory {
  id: number;
  token_symbol: string;
  direction: 'Long' | 'Short';
  leverage: number;
  entry_price: number;
  close_price?: number | null;
  current_pnl?: number | null;
  created_at: string;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [adminAuthToken, setAdminAuthToken] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<AdminTab>('withdrawals');
  const [isLoading, setIsLoading] = useState(false);
  
  // Data states
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [deposits, setDeposits] = useState<DepositTransaction[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userTradeHistory, setUserTradeHistory] = useState<TradingPositionHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setError('');
      const encodedToken = btoa(`${username}:${password}`);
      setAdminAuthToken(encodedToken);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(ADMIN_SESSION_KEY, encodedToken);
      }
      loadData('withdrawals');
    } else {
      setError('Invalid credentials');
    }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    }
    setSelectedUser(null);
    setAdminAuthToken(null);
    setIsAuthenticated(false);
  };

  const loadData = async (tab: AdminTab) => {
    setIsLoading(true);
    try {
      if (tab === 'withdrawals') {
        const { data, error } = await supabase
          .from('withdrawal_requests')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (data) setWithdrawals(data);
      } else if (tab === 'users') {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (data) setUsers(data);
      } else if (tab === 'deposits') {
        const { data, error } = await supabase
          .from('deposit_transactions')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (data) setDeposits(data);
      }
    } catch (err) {
      console.error('Error loading admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedToken = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!storedToken) return;

    try {
      const decoded = window.atob(storedToken);
      if (!decoded.includes(':')) {
        throw new Error('Invalid admin token format');
      }
      setAdminAuthToken(storedToken);
      setIsAuthenticated(true);
      loadData('withdrawals');
    } catch (err) {
      console.warn('Discarding stale admin session token', err);
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadData(activeTab);
    }
  }, [activeTab, isAuthenticated]);

  const handleApproveWithdrawal = async (id: string) => {
    if (!confirm('Are you sure you want to approve this withdrawal?')) return;
    try {
      const { error } = await supabase
        .from('withdrawal_requests')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
      loadData('withdrawals');
    } catch (err) {
      alert('Failed to approve withdrawal');
      console.error(err);
    }
  };

  const handleRejectWithdrawal = async (id: string) => {
    if (!confirm('Are you sure you want to reject this withdrawal? Funds should be manually refunded if already deducted.')) return;
    try {
      const { error } = await supabase
        .from('withdrawal_requests')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', id);
        
      if (error) throw error;
      loadData('withdrawals');
    } catch (err) {
      alert('Failed to reject withdrawal');
      console.error(err);
    }
  };

  const handleBanUser = async (user: UserProfile) => {
    const currentlyBanned = Boolean(user.is_banned);
    const actionWord = currentlyBanned ? 'UNBAN' : 'BAN';
    if (
      !confirm(
        `Are you sure you want to ${actionWord} ${user.wallet_address}?`
      )
    ) {
      return;
    }

    try {
      if (!adminAuthToken) {
        alert('Missing admin session. Please log in again.');
        return;
      }

      const response = await fetch(
        '/.netlify/functions/admin-toggle-user-ban',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${adminAuthToken}`,
          },
          body: JSON.stringify({
            walletAddress: user.wallet_address,
            isBanned: !currentlyBanned,
          }),
        }
      );

      let result: any = null;
      try {
        result = await response.json();
      } catch (error) {
        // Ignore parse errors; handled below
      }

      if (!response.ok || !result?.success) {
        if (response.status === 401) {
          alert('Admin session expired. Please log in again.');
          handleLogout();
          return;
        }
        throw new Error(result?.error || 'Failed to update ban status');
      }

      if (
        selectedUser &&
        selectedUser.wallet_address === user.wallet_address
      ) {
        setSelectedUser({ ...selectedUser, is_banned: !currentlyBanned });
      }

      loadData('users');
    } catch (err) {
      console.error(err);
      alert(`Failed to ${actionWord.toLowerCase()} user. Please try again.`);
    }
  };

  const viewUserHistory = async (user: UserProfile) => {
    setSelectedUser(user);
    setUserTradeHistory([]);
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('trading_positions')
        .select('*')
        .eq('wallet_address', user.wallet_address)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setUserTradeHistory(data || []);
    } catch (err) {
      console.error(err);
      alert('Failed to load trading history for this user.');
    } finally {
      setLoadingHistory(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-gray-900 p-8 rounded-xl border border-gray-800 w-full max-w-md">
          <div className="flex justify-center mb-6">
            <Shield className="w-12 h-12 text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-6">Admin Access</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Admin Header */}
      <div className="bg-gray-900 border-b border-gray-800 p-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <Shield className="w-6 h-6 text-blue-500" />
          <h1 className="text-xl font-bold">Admin Dashboard</h1>
        </div>
        <button 
          onClick={handleLogout}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
        >
          Logout
        </button>
      </div>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Sidebar */}
        <div className="w-64 bg-gray-900 border-r border-gray-800 p-4 hidden md:block">
          <div className="space-y-2">
            <button
              onClick={() => { setActiveTab('withdrawals'); setSelectedUser(null); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === 'withdrawals' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              <Wallet className="w-5 h-5" />
              <span>Withdrawals</span>
            </button>
            <button
              onClick={() => { setActiveTab('users'); setSelectedUser(null); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === 'users' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              <User className="w-5 h-5" />
              <span>Users</span>
            </button>
            <button
              onClick={() => { setActiveTab('deposits'); setSelectedUser(null); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === 'deposits' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              <History className="w-5 h-5" />
              <span>Deposits</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedUser ? (
            <div>
              <button 
                onClick={() => {
                  setSelectedUser(null);
                  setUserTradeHistory([]);
                }}
                className="mb-4 flex items-center text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4 mr-2" /> Back to Users
              </button>
              
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold mb-1">{selectedUser.username || 'Unknown User'}</h2>
                    <p className="text-gray-400 font-mono text-sm">{selectedUser.wallet_address}</p>
                    <div className="mt-3 flex items-center space-x-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          selectedUser.is_banned
                            ? 'bg-red-900/40 text-red-400'
                            : 'bg-green-900/30 text-green-400'
                        }`}
                      >
                        {selectedUser.is_banned ? 'Banned' : 'Active'}
                      </span>
                      <button
                        onClick={() => handleBanUser(selectedUser)}
                        className={`inline-flex items-center space-x-2 px-3 py-1 rounded text-xs font-bold border transition-colors ${
                          selectedUser.is_banned
                            ? 'text-green-400 border-green-600 hover:bg-green-900/30'
                            : 'text-red-400 border-red-700 hover:bg-red-900/40'
                        }`}
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>{selectedUser.is_banned ? 'Unban User' : 'Ban User'}</span>
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Balance</p>
                    <p className="text-xl font-bold text-blue-400">{selectedUser.sol_balance?.toFixed(4) || 0} SOL</p>
                  </div>
                </div>
              </div>

              <h3 className="text-xl font-bold mb-4">Trade History</h3>
              {loadingHistory ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-800 text-gray-400">
                      <tr>
                        <th className="px-6 py-3 font-medium">Token</th>
                        <th className="px-6 py-3 font-medium">Type</th>
                        <th className="px-6 py-3 font-medium">Entry</th>
                        <th className="px-6 py-3 font-medium">Exit</th>
                        <th className="px-6 py-3 font-medium text-right">PnL</th>
                        <th className="px-6 py-3 font-medium text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {userTradeHistory.map((trade) => {
                        const pnlValue = Number(trade.current_pnl ?? 0);
                        return (
                          <tr key={trade.id} className="hover:bg-gray-800/50">
                            <td className="px-6 py-4 font-medium">{trade.token_symbol}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded text-xs font-bold ${
                                trade.direction === 'Long' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                              }`}>
                                {trade.leverage}x {trade.direction}
                              </span>
                            </td>
                            <td className="px-6 py-4">${Number(trade.entry_price).toFixed(6)}</td>
                            <td className="px-6 py-4">${trade.close_price ? Number(trade.close_price).toFixed(6) : '-'}</td>
                            <td className={`px-6 py-4 text-right font-bold ${
                              pnlValue >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              ${pnlValue.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-right text-gray-400">
                              {new Date(trade.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        );
                      })}
                      {userTradeHistory.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                            No trading history found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <>
              {activeTab === 'withdrawals' && (
                <div>
                  <h2 className="text-2xl font-bold mb-6">Withdrawal Requests</h2>
                  {isLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    </div>
                  ) : (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-800 text-gray-400">
                          <tr>
                            <th className="px-6 py-3 font-medium">Wallet</th>
                            <th className="px-6 py-3 font-medium">Amount</th>
                            <th className="px-6 py-3 font-medium">Status</th>
                            <th className="px-6 py-3 font-medium">Date</th>
                            <th className="px-6 py-3 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {withdrawals.map((req) => (
                            <tr key={req.id} className="hover:bg-gray-800/50">
                              <td className="px-6 py-4 font-mono text-xs text-gray-300">
                                {req.wallet_address}
                              </td>
                              <td className="px-6 py-4 font-bold text-white">
                                {req.amount.toFixed(4)} SOL
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold capitalize ${
                                  req.status === 'pending' ? 'bg-yellow-900/50 text-yellow-400' :
                                  req.status === 'completed' ? 'bg-green-900/50 text-green-400' :
                                  'bg-red-900/50 text-red-400'
                                }`}>
                                  {req.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-gray-400">
                                {new Date(req.created_at).toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-right space-x-2">
                                {req.status === 'pending' && (
                                  <>
                                    <button 
                                      onClick={() => handleApproveWithdrawal(req.id)}
                                      className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-xs font-bold"
                                    >
                                      Approve
                                    </button>
                                    <button 
                                      onClick={() => handleRejectWithdrawal(req.id)}
                                      className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-bold"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          ))}
                          {withdrawals.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                No withdrawal requests found
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'users' && (
                <div>
                  <h2 className="text-2xl font-bold mb-2">User Management</h2>
                  <p className="text-gray-500 text-sm mb-6">Tap a wallet address to load the full trading history for that trader.</p>
                  {isLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    </div>
                  ) : (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-800 text-gray-400">
                          <tr>
                            <th className="px-6 py-3 font-medium">User</th>
                            <th className="px-6 py-3 font-medium">Wallet</th>
                            <th className="px-6 py-3 font-medium">Balance</th>
                            <th className="px-6 py-3 font-medium">Status</th>
                            <th className="px-6 py-3 font-medium">Joined</th>
                            <th className="px-6 py-3 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {users.map((user) => (
                            <tr 
                              key={user.id} 
                              className="hover:bg-gray-800/50"
                            >
                              <td className="px-6 py-4 font-medium text-white">
                                {user.username || 'Anonymous'}
                              </td>
                              <td className="px-6 py-4 font-mono text-xs text-gray-300">
                                <button
                                  type="button"
                                  onClick={() => viewUserHistory(user)}
                                  className="underline decoration-dotted hover:text-blue-400 transition-colors"
                                  title="Tap to view full trading history"
                                >
                                  {user.wallet_address}
                                </button>
                              </td>
                              <td className="px-6 py-4 text-blue-400 font-bold">
                                {user.sol_balance?.toFixed(4) || 0} SOL
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-bold ${
                                    user.is_banned
                                      ? 'bg-red-900/40 text-red-400'
                                      : 'bg-green-900/30 text-green-400'
                                  }`}
                                >
                                  {user.is_banned ? 'Banned' : 'Active'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-gray-400">
                                {new Date(user.created_at).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleBanUser(user);
                                  }}
                                  className={`inline-flex items-center space-x-2 px-3 py-1 rounded text-xs font-bold border transition-colors ${
                                    user.is_banned
                                      ? 'text-green-400 border-green-600 hover:bg-green-900/30'
                                      : 'text-red-400 border-red-700 hover:bg-red-900/40'
                                  }`}
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                  <span>{user.is_banned ? 'Unban' : 'Ban User'}</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                          {users.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                No users found
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'deposits' && (
                <div>
                  <h2 className="text-2xl font-bold mb-6">Deposit History</h2>
                  {isLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    </div>
                  ) : (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-800 text-gray-400">
                          <tr>
                            <th className="px-6 py-3 font-medium">Wallet</th>
                            <th className="px-6 py-3 font-medium">Amount</th>
                            <th className="px-6 py-3 font-medium">Status</th>
                            <th className="px-6 py-3 font-medium">Tx Hash</th>
                            <th className="px-6 py-3 font-medium text-right">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {deposits.map((dep) => (
                            <tr key={dep.id} className="hover:bg-gray-800/50">
                              <td className="px-6 py-4 font-mono text-xs text-gray-300">
                                {dep.wallet_address.slice(0, 8)}...
                              </td>
                              <td className="px-6 py-4 font-bold text-green-400">
                                +{dep.amount.toFixed(4)} SOL
                              </td>
                              <td className="px-6 py-4">
                                <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-900/50 text-green-400 capitalize">
                                  {dep.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-mono text-xs text-gray-500 truncate max-w-[150px]">
                                {(dep as any).txid || 'N/A'}
                              </td>
                              <td className="px-6 py-4 text-right text-gray-400">
                                {new Date(dep.created_at).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                          {deposits.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                No deposits found
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
