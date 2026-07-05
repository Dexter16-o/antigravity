'use client';

import { useState, useRef } from 'react';
import { Image as ImageIcon, X, Send } from 'lucide-react';
import { createPost, isMockMode, supabase } from '@/lib/supabase';

interface PostComposerProps {
  sessionId: string;
  onPostCreated: () => void;
}

export default function PostComposer({ sessionId, onPostCreated }: PostComposerProps) {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('General');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxChars = 300;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        setErrorMsg('Image size must be less than 4MB');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setErrorMsg(null);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadImage = async (file: File): Promise<string> => {
    if (isMockMode) {
      // Mock mode: Return base64 representation of image to store in localStorage
      return imagePreview || '';
    }

    // Supabase mode: Upload to 'post-images' bucket
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `posts/${fileName}`;

    const { error: uploadError } = await supabase!.storage
      .from('post-images')
      .upload(filePath, file);

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const { data } = supabase!.storage
      .from('post-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    if (content.length > maxChars) return;

    if (!navigator.onLine) {
      setErrorMsg('Cannot create post: You are offline.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      await createPost(content.trim(), imageUrl, sessionId, category);
      
      // Clear composer state
      setContent('');
      setCategory('General');
      removeImage();
      onPostCreated();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to submit post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm p-4 mb-6 transition-all duration-300">
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-100 dark:border-red-900/50 animate-pulse">
            {errorMsg}
          </div>
        )}

        <div className="relative">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, maxChars))}
            placeholder="Share an anonymous thought with your campus..."
            className="w-full min-h-[90px] text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 bg-transparent border-0 resize-none focus:ring-0 focus:outline-none text-base"
            disabled={isSubmitting}
            id="post-composer-textarea"
          />
        </div>

        {imagePreview && (
          <div className="relative inline-block rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 max-h-[220px]">
            <img
              src={imagePreview}
              alt="Preview"
              className="max-h-[200px] w-auto object-cover rounded-xl"
            />
            <button
              type="button"
              onClick={removeImage}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-all duration-200 shadow-md backdrop-blur-sm"
              id="clear-image-btn"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800/80">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-850 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-all duration-200"
              disabled={isSubmitting}
              id="attach-image-btn"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className="hidden"
            />

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold text-gray-550 dark:text-gray-350 cursor-pointer"
              id="post-category-select"
              disabled={isSubmitting}
            >
              <option value="General">General</option>
              <option value="Placements">Placements</option>
              <option value="Hostel/Mess">Hostel/Mess</option>
              <option value="Academics">Academics</option>
              <option value="Lost & Found">Lost & Found</option>
              <option value="Marketplace">Marketplace</option>
              <option value="Faculty Reviews">Faculty Reviews</option>
            </select>
          </div>

          <div className="flex items-center space-x-4">
            <span
              className={`text-xs font-semibold tabular-nums ${
                content.length >= maxChars - 20
                  ? 'text-red-500'
                  : content.length >= maxChars - 50
                  ? 'text-amber-500'
                  : 'text-gray-400 dark:text-gray-600'
              }`}
            >
              {maxChars - content.length}
            </span>

            <button
              type="submit"
              disabled={!content.trim() || isSubmitting}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 active:scale-95 ${
                !content.trim() || isSubmitting
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                  : 'bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white shadow-sm shadow-emerald-500/20'
              }`}
              id="post-submit-btn"
            >
              <span>Share</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
