import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-navbar',
  imports: [],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  constructor(private router: Router) {}

  getUsername(): string {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('username') || 'Guest';
    }
    return 'Guest';
  }

  getFullName(): string {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('full_name') || '';
    }
    return '';
  }

  getInitials(): string {
    const fullName = this.getFullName();
    if (fullName) {
      const parts = fullName.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return parts[0].slice(0, 2).toUpperCase();
    }
    const email = this.getUsername();
    if (email === 'Guest') return 'G';
    return email.slice(0, 2).toUpperCase();
  }

  onLogout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('username');
      localStorage.removeItem('full_name');
      this.router.navigate(['/login']);
    }
  }
}
