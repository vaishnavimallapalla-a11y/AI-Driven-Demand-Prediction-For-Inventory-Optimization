import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const ForgotPasswordPage = () => {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold font-headline tracking-tight text-on-surface">Reset Password</h2>
        <p className="text-outline">Enter your email and we'll send you instructions to reset your password.</p>
      </div>

      <form className="space-y-6">
        <div className="space-y-1">
          <label className="text-xs font-bold text-outline uppercase tracking-widest">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" size={18} />
            <input 
              type="email" 
              required
              placeholder="name@company.com"
              className="w-full bg-surface-container-low border-none rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-sm outline-none"
            />
          </div>
        </div>

        <Button type="submit" variant="gradient" className="w-full py-4 text-lg">Send Reset Link</Button>
      </form>

      <p className="text-center text-sm text-outline">
        <Link to="/auth/login" className="text-primary font-bold hover:underline flex items-center justify-center gap-2">
          <ArrowLeft size={16} />
          Back to login
        </Link>
      </p>
    </div>
  );
};
