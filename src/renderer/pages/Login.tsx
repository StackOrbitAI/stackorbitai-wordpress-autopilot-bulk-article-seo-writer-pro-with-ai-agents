import React, { useState } from 'react';
import { KeyRound, ShieldCheck, Cpu, Terminal } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';

interface LoginProps {
  onActivate: (licenseKey: string) => Promise<boolean>;
}

const Login: React.FC<LoginProps> = ({ onActivate }) => {
  const [licenseKey, setLicenseKey] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [offlineMode, setOfflineMode] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKey.trim()) {
      setError('Please enter a valid license key.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (offlineMode) {
        // Mock offline check - accept any key starting with 'SOAI-' or 'LICENSE-'
        await new Promise(resolve => setTimeout(resolve, 1500));
        const keyUpper = licenseKey.trim().toUpperCase();
        if (keyUpper.startsWith('SOAI-') || keyUpper.startsWith('LICENSE-') || keyUpper.length > 10) {
          await onActivate(licenseKey.trim());
        } else {
          setError('Invalid offline license key. Format: SOAI-XXXX-XXXX');
        }
      } else {
        // Standard activation
        const success = await onActivate(licenseKey.trim());
        if (!success) {
          setError('License activation failed. Please check key or internet connection.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Verification endpoint timeout.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 relative overflow-hidden select-none">
      {/* Decorative gradient glowing blurs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px]" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-violet-600/10 rounded-full blur-[100px]" />

      <Card className="w-full max-w-md border-zinc-800 bg-zinc-900/60 p-2 shadow-2xl relative z-10 glass animate-in fade-in slide-in-from-bottom-4 duration-300">
        <CardHeader className="text-center pb-2">
          {/* Logo */}
          <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xl font-bold font-outfit shadow-lg shadow-indigo-500/20 mb-4 animate-pulse">
            S
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight font-outfit text-zinc-100">
            Activate StackOrbitAI
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Enter your license key to unlock Bulk Writer Pro.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <label htmlFor="license" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                License Key
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <Input
                  id="license"
                  type="password"
                  placeholder="SOAI-XXXX-XXXX-XXXX"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  className="pl-10 bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Offline Mode Option */}
            <div className="flex items-center space-x-2 pt-2">
              <input
                id="offline"
                type="checkbox"
                checked={offlineMode}
                onChange={(e) => setOfflineMode(e.target.checked)}
                className="rounded border-zinc-800 bg-zinc-950 text-indigo-600 focus:ring-indigo-500/30 h-4 w-4 accent-indigo-600 cursor-pointer"
                disabled={loading}
              />
              <label htmlFor="offline" className="text-xs font-medium text-zinc-400 cursor-pointer select-none">
                Enable Offline Activation Mode
              </label>
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/40 p-3 rounded-lg flex items-start space-x-2">
                <span className="font-bold">Error:</span>
                <span>{error}</span>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col space-y-4 pt-2 pb-6">
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold font-outfit shadow-md shadow-indigo-500/10"
              disabled={loading}
            >
              {loading ? 'Activating License...' : 'Activate Device'}
            </Button>

            {/* Micro details */}
            <div className="grid grid-cols-3 gap-2 w-full pt-4 border-t border-zinc-800/60 text-zinc-500 text-[10px] text-center font-medium">
              <div className="flex flex-col items-center">
                <ShieldCheck className="h-4 w-4 mb-1 text-zinc-600" />
                <span>AES Secured</span>
              </div>
              <div className="flex flex-col items-center">
                <Cpu className="h-4 w-4 mb-1 text-zinc-600" />
                <span>Device Linked</span>
              </div>
              <div className="flex flex-col items-center">
                <Terminal className="h-4 w-4 mb-1 text-zinc-600" />
                <span>v1.0.0 Stable</span>
              </div>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Login;
