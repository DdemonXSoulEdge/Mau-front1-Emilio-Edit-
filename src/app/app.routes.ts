import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { HomeComponent } from './components/home/home';
import { DashboardComponent } from './components/dashboard/dashboard';
import { HistorialComponent } from './components/historial/historial';
import { DayDetailComponent } from './components/day-detail/day-detail';
import { MapaComponent } from './components/mapa/mapa';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'home', component: HomeComponent },
  { path: 'dashboard', component: DashboardComponent},
  { path: 'historial', component: HistorialComponent},
  { path: 'day-detail', component: DayDetailComponent },
  { path: 'day-detail/:id', component: DayDetailComponent },
  { path: 'mapa', component: MapaComponent }
];
