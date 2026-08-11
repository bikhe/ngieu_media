import React, { useState, useEffect, useContext } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  useTheme,
  useMediaQuery,
  alpha
} from '@mui/material';
import { 
  Home, 
  BarChart2, 
  Package, 
  Users, 
  Palette,
  LogOut,
  User as UserIcon,
  Menu
} from 'lucide-react';
import { apiService } from '../services/api';
import { ThemeSettingsContext } from '../theme/ThemeSettingsContext';
import ProfileModal from '../components/ProfileModal';

const DRAWER_WIDTH = 280;

export const MainLayout = () => {
  const muiTheme = useTheme();
  const isDesktop = useMediaQuery(muiTheme.breakpoints.up('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { openSetup } = useContext(ThemeSettingsContext);
  
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const data = await apiService.getUserMe();
        setMe(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchMe();
  }, []);

  if (loading) return null;

  const isAdmin = me?.role === 'MAIN_ADMIN' || me?.is_staff || me?.is_superuser;

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    window.location.reload();
  };

  const adminMenu = [
    { title: 'Дашборд', path: '/', icon: <Home size={20} /> },
    { title: 'Склад', path: '/warehouse', icon: <Package size={20} /> },
    { title: 'Аналитика (В разработке)', path: '/analytics', icon: <BarChart2 size={20} />, disabled: true },
    { title: 'Пользователи', path: '/users', icon: <Users size={20} /> },
  ];

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ bgcolor: 'primary.main', fontWeight: 'bold' }}>
          {me?.username?.[0]?.toUpperCase()}
        </Avatar>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>{me?.username}</Typography>
          <Typography variant="caption" color="text.secondary">
            {isAdmin ? 'Администратор' : 'Участник'}
          </Typography>
        </Box>
      </Box>

      <List sx={{ px: 2, flex: 1 }}>
        {isAdmin ? adminMenu.map((item) => {
          const active = location.pathname === item.path;
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                disabled={item.disabled}
                selected={active}
                onClick={() => {
                  if (item.disabled) return;
                  navigate(item.path);
                  if (!isDesktop) setMobileOpen(false);
                }}
                sx={{
                  borderRadius: '16px',
                  bgcolor: active ? alpha(muiTheme.palette.primary.main, 0.1) : 'transparent',
                  opacity: item.disabled ? 0.5 : 1,
                  '&:hover': { bgcolor: alpha(muiTheme.palette.primary.main, 0.05) },
                  '&.Mui-selected': { bgcolor: alpha(muiTheme.palette.primary.main, 0.15) }
                }}
              >
                <ListItemIcon sx={{ color: active ? 'primary.main' : 'inherit', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.title} 
                  primaryTypographyProps={{ fontWeight: active ? 700 : 500, color: active ? 'primary.main' : 'inherit' }} 
                />
              </ListItemButton>
            </ListItem>
          );
        }) : null}
      </List>

      <Box sx={{ p: 2 }}>
        <List disablePadding>
          <ListItem disablePadding sx={{ mb: 1 }}>
            <ListItemButton onClick={openSetup} sx={{ borderRadius: '16px' }}>
              <ListItemIcon sx={{ minWidth: 40 }}><Palette size={20} /></ListItemIcon>
              <ListItemText primary="Тема и шрифт" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding sx={{ mb: 1 }}>
            <ListItemButton onClick={() => setProfileOpen(true)} sx={{ borderRadius: '16px' }}>
              <ListItemIcon sx={{ minWidth: 40 }}><UserIcon size={20} /></ListItemIcon>
              <ListItemText primary="Профиль" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton onClick={handleLogout} sx={{ borderRadius: '16px', color: 'error.main' }}>
              <ListItemIcon sx={{ minWidth: 40, color: 'error.main' }}><LogOut size={20} /></ListItemIcon>
              <ListItemText primary="Выйти" />
            </ListItemButton>
          </ListItem>
        </List>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Top App Bar for mobile Admin, or Desktop if needed */}
      {(isAdmin || isDesktop) && (
        <AppBar
          position="fixed"
          elevation={0}
          sx={{
            width: isDesktop && isAdmin ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%',
            ml: isDesktop && isAdmin ? `${DRAWER_WIDTH}px` : 0,
            bgcolor: alpha(muiTheme.palette.background.default, 0.75),
            backdropFilter: 'blur(20px)',
            borderBottom: `1px solid ${alpha(muiTheme.palette.divider, 0.1)}`,
            color: 'text.primary',
          }}
        >
          <Toolbar sx={{ justifyContent: isAdmin && isDesktop ? 'flex-end' : 'space-between' }}>
            {(!isDesktop || !isAdmin) && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {isAdmin && (
                  <IconButton onClick={handleDrawerToggle} edge="start" sx={{ mr: 1 }}>
                    <Menu size={24} />
                  </IconButton>
                )}
                <Typography variant="h6" sx={{ fontWeight: 800 }}>Media Events</Typography>
              </Box>
            )}
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton onClick={openSetup} color="primary" className="soft-card">
                <Palette size={20} />
              </IconButton>
              {!isAdmin && (
                <IconButton onClick={() => setProfileOpen(true)} color="primary" className="soft-card">
                  <UserIcon size={20} />
                </IconButton>
              )}
            </Box>
          </Toolbar>
        </AppBar>
      )}

      {/* Sidebar for Admins */}
      {isAdmin && (
        <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
          {isDesktop ? (
            <Drawer
              variant="permanent"
              sx={{
                display: { xs: 'none', md: 'block' },
                '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH, borderRight: 'none', bgcolor: 'background.paper', boxShadow: '4px 0 24px rgba(0,0,0,0.02)' },
              }}
              open
            >
              {drawerContent}
            </Drawer>
          ) : (
            <Drawer
              variant="temporary"
              open={mobileOpen}
              onClose={handleDrawerToggle}
              ModalProps={{ keepMounted: true }}
              sx={{
                display: { xs: 'block', md: 'none' },
                '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH, bgcolor: 'background.paper' },
              }}
            >
              {drawerContent}
            </Drawer>
          )}
        </Box>
      )}

      {/* Main Content Area */}
      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          p: { xs: 2, md: 3 }, 
          mt: (isAdmin || isDesktop) ? 8 : 0, // offset for AppBar
          mb: (!isAdmin && !isDesktop) ? 8 : 0, // offset for BottomNav
          width: isAdmin && isDesktop ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%',
        }}
      >
        <Outlet />
      </Box>

      {/* Profile Modal */}
      {profileOpen && (
        <ProfileModal
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          user={me}
          onSave={() => {}}
        />
      )}
    </Box>
  );
};

export default MainLayout;
