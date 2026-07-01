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

  getInitials(): string {
    const name = this.getUsername();
    if (name === 'Guest') return 'G';
    return name.slice(0, 2).toUpperCase();
  }

  onLogout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('username');
      this.router.navigate(['/login']);
    }
  }
}
