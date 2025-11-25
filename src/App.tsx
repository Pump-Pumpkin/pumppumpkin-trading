import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { WalletContextProvider } from './components/WalletProvider';
import WalletButton from './components/WalletButton';
import TermsOfService from './components/TermsOfService';
import SetupProfile from './components/SetupProfile';
import Dashboard from './components/Dashboard';
import LoadingScreen from './components/LoadingScreen';
import { userProfileService, UserProfile } from './services/supabaseClient';
import { initializeBusinessPlanOptimizations } from './services/birdeyeApi';
import LandingPage from './components/LandingPage';
import AdminPage from './components/AdminPage';

type AppState = 'connect' | 'terms' | 'profile' | 'dashboard' | 'loading';

function TradingApp() {
  const [currentState, setCurrentState] = useState<AppState>('connect');
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);





  const handleWalletConnect = async (publicKey: string) => {
    setWalletAddress(publicKey);
    setIsConnected(true);
    setIsLoadingProfile(true);
    setCurrentState('loading');

    try {
      console.log('🔍 Checking for existing profile:', publicKey);
      
      // Check if user profile exists
      const existingProfile = await userProfileService.getProfile(publicKey);
      
      if (existingProfile) {
        console.log('✅ Existing profile found:', existingProfile.username);
        setUserProfile(existingProfile);
        setCurrentState('dashboard');
      } else {
        console.log('📝 No profile found, redirecting to setup');
        setCurrentState('profile');
      }
    } catch (error) {
      console.error('💥 Error checking profile:', error);
      setCurrentState('profile'); // Fallback to profile setup
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleConnectWithoutWallet = () => {
    console.log('👀 Connecting without wallet - guest mode');
    setWalletAddress('guest');
    setIsConnected(false);
    
    // Create a guest profile
    const guestProfile = {
      id: 'guest',
      wallet_address: 'guest',
      username: 'Guest User',
      profile_image: undefined,
      balance: 0,
      sol_balance: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    setUserProfile(guestProfile);
    setCurrentState('dashboard');
  };

  const handleShowTerms = () => {
    setCurrentState('terms');
  };

  const handleBackFromTerms = () => {
    setCurrentState('connect');
  };

  const handleBackFromProfile = () => {
    setCurrentState('connect');
    setIsConnected(false);
    setWalletAddress('');
    setUserProfile(null);
  };

  const handleCompleteProfile = async (profileData: { username: string; profilePicture?: string }) => {
    setCurrentState('loading');
    
    try {
      console.log('💾 Creating new profile in database...');
      
      const newProfile = await userProfileService.createProfile({
        wallet_address: walletAddress,
        username: profileData.username,
        profile_image: profileData.profilePicture,
        balance: 0, // Set default USD balance to 0
        sol_balance: 0, // Set default SOL balance to 0
      });

      if (newProfile) {
        console.log('✅ Profile created successfully');
        setUserProfile(newProfile);
        setCurrentState('dashboard');
      } else {
        console.error('❌ Failed to create profile');
        // Still proceed to dashboard with local data
        setUserProfile({
          id: 'temp',
          wallet_address: walletAddress,
          username: profileData.username,
          profile_image: profileData.profilePicture,
          balance: 0, // Set default USD balance to 0
          sol_balance: 0, // Set default SOL balance to 0
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        setCurrentState('dashboard');
      }
    } catch (error) {
      console.error('💥 Error creating profile:', error);
      // Fallback to local profile
      setUserProfile({
        id: 'temp',
        wallet_address: walletAddress,
        username: profileData.username,
        profile_image: profileData.profilePicture,
        balance: 0, // Set default USD balance to 0
        sol_balance: 0, // Set default SOL balance to 0
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      setCurrentState('dashboard');
    }
  };

  const handleUpdateBalance = async (newBalance: number) => {
    if (userProfile) {
      // Update local state immediately
      setUserProfile(prev => prev ? { ...prev, balance: newBalance } : null);
      
      // Update in database
      try {
        await userProfileService.updateBalance(walletAddress, newBalance);
        console.log('✅ USD balance updated in database');
      } catch (error) {
        console.error('💥 Error updating USD balance in database:', error);
      }
    }
  };

  const handleUpdateSOLBalance = async (newSOLBalance: number) => {
    if (userProfile) {
      // Update local state immediately
      setUserProfile(prev => prev ? { ...prev, sol_balance: newSOLBalance } : null);
      
      // Update in database
      try {
        await userProfileService.updateSOLBalance(walletAddress, newSOLBalance);
        console.log('✅ SOL balance updated in database');
      } catch (error) {
        console.error('💥 Error updating SOL balance in database:', error);
      }
    }
  };

  const handleUpdateBothBalances = async (newBalance: number, newSOLBalance: number) => {
    if (userProfile) {
      // Update local state immediately
      setUserProfile(prev => prev ? { 
        ...prev, 
        balance: newBalance,
        sol_balance: newSOLBalance 
      } : null);
      
      // Update in database
      try {
        await userProfileService.updateBalances(walletAddress, newBalance, newSOLBalance);
        console.log('✅ Both balances updated in database');
      } catch (error) {
        console.error('💥 Error updating balances in database:', error);
      }
    }
  };

  // Simple Loading state - matches connect wallet page design
  if (currentState === 'loading' || isLoadingProfile) {
    return <LoadingScreen walletAddress={walletAddress} />;
  }

  // Terms of Service page
  if (currentState === 'terms') {
    return <TermsOfService onBack={handleBackFromTerms} />;
  }

  // Profile Setup page
  if (currentState === 'profile' && isConnected) {
    return (
      <SetupProfile 
        onBack={handleBackFromProfile}
        onComplete={handleCompleteProfile}
        walletAddress={walletAddress}
      />
    );
  }

  // Dashboard
  if (currentState === 'dashboard' && userProfile) {
    return (
      <Dashboard 
        username={userProfile.username}
        profilePicture={userProfile.profile_image}
        walletAddress={walletAddress}
        balance={userProfile.balance}
        solBalance={userProfile.sol_balance} // Pass SOL balance to Dashboard
        onUpdateBalance={handleUpdateBalance}
        onUpdateSOLBalance={handleUpdateSOLBalance}
        onUpdateBothBalances={handleUpdateBothBalances}
        onShowTerms={handleShowTerms}
      />
    );
  }

  // Connect Wallet page (default)
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 sm:p-4">
      <div className="text-center max-w-sm w-full mx-auto px-6 sm:px-4">
        {/* Character Icon - Mobile optimized */}
        <div className="mb-4 sm:mb-8">
          <div className="w-24 h-24 mx-auto">
            <img 
              src="https://i.imgur.com/fWVz5td.png" 
              alt="Pump Pumpkin Icon" 
              className="w-full h-full object-cover rounded-xl"
            />
          </div>
        </div>

        {/* Welcome Text - Mobile optimized */}
        <h1 className="text-3xl font-normal mb-4">
          Welcome To <span style={{ color: '#1e7cfa' }}>Pump Pumpkin</span>
        </h1>
        
        {/* Subtitle - Mobile optimized */}
        <p className="text-gray-400 text-lg mb-4">Pump.Fun Leverage Trading</p>
        
        {/* Connect text - Mobile optimized */}
        <p className="text-gray-500 text-sm mb-8">Connect Your Solana Wallet To Start Trading</p>
        
        {/* Wallet Connection Button */}
        <WalletButton onConnect={handleWalletConnect} />
        
        {/* Without Wallet Button */}
        <div className="flex justify-center px-4 mt-4">
          <button
            onClick={handleConnectWithoutWallet}
            className="w-full max-w-[280px] py-4 px-6 bg-blue-600 hover:bg-blue-700 text-black border-0 rounded-xl text-base font-medium min-h-[56px] transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] cursor-pointer touch-manipulation"
            style={{ backgroundColor: '#1e7cfa' }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.backgroundColor = '#1a6ce8';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.backgroundColor = '#1e7cfa';
            }}
          >
            Without Wallet
          </button>
        </div>
        
        {/* Terms - Larger text for mobile */}
        <p className="text-gray-600 text-sm mt-6">
          By Connecting You Agree To Our{' '}
          <span 
            style={{ color: '#1e7cfa' }} 
            className="underline cursor-pointer hover:text-blue-300 transition-colors"
            onClick={handleShowTerms}
          >
            Terms Of Service
          </span>
        </p>
      </div>
    </div>
  );
}

function App() {
  // BUSINESS PLAN: Initialize optimizations on app startup
  useEffect(() => {
    console.log('🚀 BUSINESS PLAN: Initializing professional trading optimizations...');
    initializeBusinessPlanOptimizations();
  }, []);

  return (
    <WalletContextProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/trading" element={<TradingApp />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </WalletContextProvider>
  );
}

export default App;