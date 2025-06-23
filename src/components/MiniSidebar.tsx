import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { menuItems } from './Sidebar';

const MiniSidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Solo ítems principales, sin submenús ni dividers
  const filteredItems = menuItems.filter(item => !item.divider && !item.submenu);

  return (
    <div className="h-full flex flex-col items-center bg-white shadow-lg w-14 py-4 space-y-2">
      {/* Favicon en la parte superior */}
      <img src="/Favicon.png" alt="Logo" className="h-8 w-8 mb-4" />
      {filteredItems.map(item => (
        <button
          key={item.title}
          title={item.title}
          onClick={() => navigate(item.path)}
          className={`flex items-center justify-center w-10 h-10 rounded-md transition-colors
            ${location.pathname.startsWith(item.path) ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-200'}`}
        >
          {item.icon}
        </button>
      ))}
    </div>
  );
};

export default MiniSidebar; 