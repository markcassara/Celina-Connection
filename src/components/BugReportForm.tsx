import React, { useState, useEffect } from 'react';
import { ReportedBug } from '../types';
import { AlertCircle, Bug, CheckCircle, X } from 'lucide-react';

interface BugReportFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (bug: {
    title: string;
    description: string;
    category: 'visual' | 'functional' | 'data' | 'other';
    severity: 'low' | 'medium' | 'high';
    email: string;
  }) => void;
  currentUserEmail?: string;
}

export default function BugReportForm({
  isOpen,
  onClose,
  onSubmit,
  currentUserEmail = '',
}: BugReportFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'visual' | 'functional' | 'data' | 'other'>('functional');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [email, setEmail] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Auto-fill email if logged-in user changes
  useEffect(() => {
    if (currentUserEmail) {
      setEmail(currentUserEmail);
    }
  }, [currentUserEmail]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !email.trim()) {
      alert('Please fill out all required fields.');
      return;
    }

    onSubmit({
      title: title.trim(),
      description: description.trim(),
      category,
      severity,
      email: email.trim(),
    });

    // Show success message
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      // Reset form
      setTitle('');
      setDescription('');
      setCategory('functional');
      setSeverity('medium');
      onClose();
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="bug-report-modal">
      {/* Backdrop */}
      <div 
        onClick={onClose} 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" 
      />

      {/* Modal Card */}
      <div className="relative bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xl max-w-md w-full z-10 overflow-hidden animate-fade-in">
        {/* Header decoration */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 to-amber-500" />
        
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-50 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {isSuccess ? (
          <div className="py-8 text-center space-y-4 animate-scale-in">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display font-black text-slate-900 text-lg">Bug Submitted Successfully!</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                Thank you for helping us improve Celina Connection. The system administrator (Mark) has been notified.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-50 text-rose-500 rounded-2xl">
                <Bug className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-black text-slate-900 text-lg">Report a Bug</h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Found something broken? Let us know ASAP so we can resolve it immediately.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Your Contact Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Short Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mass change listings fails to save state"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 font-semibold cursor-pointer"
                  >
                    <option value="visual">🎨 Visual issue</option>
                    <option value="functional">⚙️ Functional broken</option>
                    <option value="data">📊 Database incorrect</option>
                    <option value="other">❓ Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Severity
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 font-semibold cursor-pointer"
                  >
                    <option value="low">⚪ Low (Visual/Minor)</option>
                    <option value="medium">🟡 Medium (Flow issue)</option>
                    <option value="high">🔴 High (Crash/Data loss)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Detailed Bug Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  placeholder="Please describe what you clicked, what you expected, and what happened instead..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 font-semibold"
                />
              </div>

              <div className="flex gap-2.5 justify-end pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs rounded-xl cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold text-xs rounded-xl shadow-md hover:from-rose-600 hover:to-amber-600 cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <AlertCircle className="w-3.5 h-3.5" /> Report ASAP
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
