import React, { useState, useRef } from 'react';
import { ArrowLeft, Upload, User, Save, X } from 'lucide-react';
import { userProfileService } from '../services/supabaseClient';

interface EditProfileProps {
  onBack: () => void;
  onSave: (profileData: { username: string; profilePicture?: string }) => void;
  currentUsername: string;
  currentProfilePicture?: string;
  walletAddress: string;
}

export default function EditProfile({ 
  onBack, 
  onSave, 
  currentUsername, 
  currentProfilePicture, 
  walletAddress 
}: EditProfileProps) {
  const [username, setUsername] = useState(currentUsername);
  const [profilePicture, setProfilePicture] = useState<string | null>(currentProfilePicture || null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be smaller than 5MB');
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setProfilePicture(e.target?.result as string);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    if (username.trim().length < 2) {
      setError('Username must be at least 2 characters');
      return;
    }

    if (username.trim().length > 20) {
      setError('Username must be less than 20 characters');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      console.log('Updating profile in database...');
      
      const updatedProfile = await userProfileService.updateProfile(walletAddress, {
        username: username.trim(),
        profile_image: profilePicture || undefined,
      });

      if (updatedProfile) {
        console.log('Profile updated successfully');
        onSave({
          username: username.trim(),
          profilePicture: profilePicture || undefined,
        });
      } else {
        setError('Failed to update profile. Please try again.');
      }
    } catch (error) {
              console.error('Error updating profile:', error);
      setError('Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveImage = () => {
    setProfilePicture(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const hasChanges = username.trim() !== currentUsername || profilePicture !== currentProfilePicture;

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="text-center max-w-md w-full">
        {/* Back Button */}
        <button 
          onClick={onBack}
          disabled={isSaving}
          className="absolute top-6 left-6 flex items-center text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </button>

        {/* Profile Picture */}
        <div className="mb-8">
          <div className="w-20 h-20 mx-auto relative">
            {profilePicture ? (
              <div className="relative">
                <img 
                  src={profilePicture} 
                  alt="Profile Picture" 
                  className="w-full h-full object-cover rounded-lg"
                />
                <button
                  onClick={handleRemoveImage}
                  disabled={isSaving}
                  className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 transition-colors disabled:opacity-50"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="w-full h-full bg-gray-800 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-600">
                <User className="w-8 h-8 text-gray-500" />
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-normal mb-2">
          Edit <span style={{ color: '#1e7cfa' }}>Profile</span>
        </h1>
        
        {/* Subtitle */}
        <p className="text-gray-400 text-lg mb-8">Update Your Trading Profile</p>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900 border border-red-700 rounded-lg p-3 mb-6">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Form */}
        <div className="space-y-6">
          {/* Username Input */}
          <div>
            <label className="block text-gray-400 text-sm mb-2 text-left">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isSaving}
              maxLength={20}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all disabled:opacity-50"
              placeholder="Enter your username"
            />
            <p className="text-gray-500 text-xs mt-1 text-left">
              {username.length}/20 characters
            </p>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={isSaving}
            className="hidden"
          />

          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isSaving}
            className="w-full bg-gray-800 border border-gray-600 hover:border-blue-400 text-white font-medium py-3 px-6 rounded-lg transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <Upload className="w-5 h-5" />
            <span>{profilePicture ? 'Change Picture' : 'Upload Picture'}</span>
          </button>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving || !username.trim()}
            className="w-full text-black font-medium py-3 px-6 rounded-lg transition-colors disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            style={{ 
              backgroundColor: (!hasChanges || isSaving || !username.trim()) ? '#374151' : '#1e7cfa',
              color: (!hasChanges || isSaving || !username.trim()) ? '#9ca3af' : 'black'
            }}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>

          {/* Cancel Button */}
          <button
            onClick={onBack}
            disabled={isSaving}
            className="w-full bg-transparent border border-gray-600 hover:border-gray-500 text-gray-400 hover:text-gray-300 font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>

        {/* Info */}
        <p className="text-gray-600 text-xs mt-6">
          Profile changes are saved to your account and synced across devices
        </p>
      </div>
    </div>
  );
}