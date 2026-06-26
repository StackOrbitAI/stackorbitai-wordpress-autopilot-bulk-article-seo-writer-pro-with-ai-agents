import React from 'react';
import { 
  LayoutDashboard, 
  Globe, 
  KeyRound, 
  FileEdit, 
  PlaySquare, 
  History, 
  Settings as SettingsIcon, 
  LogOut 
} from 'lucide-react';
import { cn } from '../../utils/cn';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isActivated: boolean;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isActivated, onLogout }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, disabled: !isActivated },
    { id: 'websites', label: 'WordPress Sites', icon: Globe, disabled: !isActivated },
    { id: 'providers', label: 'AI Providers', icon: KeyRound, disabled: !isActivated },
    { id: 'tasks', label: 'Bulk Tasks', icon: FileEdit, disabled: !isActivated },
    { id: 'queue', label: 'Task Monitor', icon: PlaySquare, disabled: !isActivated },
    { id: 'history', label: 'Post History', icon: History, disabled: !isActivated },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, disabled: !isActivated }
  ];

  return (
    <aside className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col h-full select-none">
      {/* Brand Logo Header */}
      <div className="h-16 flex items-center px-6 border-b border-zinc-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold font-outfit shadow-md">
            S
          </div>
          <div>
            <h1 className="text-md font-bold font-outfit tracking-wide bg-gradient-to-r from-zinc-50 to-zinc-300 bg-clip-text text-transparent">
              StackOrbit<span className="text-indigo-400">AI</span>
            </h1>
            <p className="text-[10px] text-zinc-500 font-medium">BULK WRITER PRO</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              disabled={item.disabled}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex items-center space-x-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 outline-none text-left",
                item.disabled && "opacity-40 cursor-not-allowed",
                !item.disabled && activeTab === item.id 
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" 
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 border border-transparent"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
              {item.id === 'queue' && activeTab !== 'queue' && (
                <span className="ml-auto w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom User Area */}
      <div className="p-4 border-t border-zinc-800 text-center">
        <span className="text-[10px] text-zinc-500 font-semibold tracking-widest uppercase">
          Open Source Edition
        </span>
      </div>
    </aside>
  );
};

export default Sidebar;
