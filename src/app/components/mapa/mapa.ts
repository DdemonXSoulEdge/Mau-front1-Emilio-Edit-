import { Component, OnInit, AfterViewInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { GoogleMapsModule, GoogleMap } from '@angular/google-maps';

interface Marker {
  id: number;
  lat: number;
  lng: number;
  title: string;
  icon: google.maps.Icon;
}

type WeatherState = 'night' | 'cloudy' | 'rainy' | 'sunny';

@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [CommonModule, GoogleMapsModule],
  providers: [GoogleMap],
  templateUrl: './mapa.html',
  styleUrls: ['./mapa.scss']
})
export class MapaComponent implements OnInit, AfterViewInit {

  @ViewChild(GoogleMap, { static: false }) map!: GoogleMap;

  center: google.maps.LatLngLiteral = { lat: 20.5888, lng: -100.3961 };
  zoomLevel = 10;
  isReporting = false;
  selectedCoords: { lat: number; lng: number } | null = null;

  private defaultIcon: google.maps.Icon = {
    url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
  };

  markers: Marker[] = [];
  currentDate = '';
  currentTemp = '— °C';
  location = 'Estación - Universidad Tecnológica de Querétaro';

  private currentWeatherState: WeatherState = 'sunny';

  private weatherDescriptions: Record<WeatherState, string> = {
    night: 'Noche despejada, sin riesgo de lluvia.',
    cloudy: 'Cielo parcialmente cubierto o neblina matutina.',
    rainy: 'Lluvias moderadas, mantén precaución al conducir.',
    sunny: 'Cielos despejados y temperaturas agradables.'
  };

  private backendUrl = 'https://login-spe2.onrender.com';
  private http = inject(HttpClient);

  constructor(private router: Router) {}

  ngOnInit() {
    this.updateCurrentDate();
    this.loadWeatherData();
    this.loadMarkers();
  }

  ngAfterViewInit() {
    this.initializeMap();
  }

  private loadWeatherData(): void {
    this.http
      .get<any[]>('https://weatheriadx-default-rtdb.firebaseio.com/json_data.json')
      .subscribe({
        next: (data) => {
          if (Array.isArray(data) && data.length > 0) {
            const registro = data[data.length - 1];
            this.currentTemp = `${registro.temp} °C`;
            this.currentWeatherState = this.getWeatherState(registro);
          } else {
            console.warn('No hay datos disponibles en Firebase (json_data).');
          }
        },
        error: (err) => console.error('Error al cargar json_data desde Firebase:', err)
      });
  }

  private getWeatherState(registro: any): WeatherState {
    const hora = new Date().getHours();

    if (registro && typeof registro.precipRate === 'number' && registro.precipRate > 0.1) {
      return 'rainy';
    } else if (hora >= 20 || hora < 6) {
      return 'night';
    } else if (registro && typeof registro.humidity === 'number' && registro.humidity >= 75) {
      return 'cloudy';
    } else {
      return 'sunny';
    }
  }

  get currentDescription(): string {
    return this.weatherDescriptions[this.currentWeatherState];
  }

  private initializeMap() {
    if (this.map?.googleMap) {
      this.map.googleMap.setCenter(this.center);
      this.map.googleMap.setZoom(this.zoomLevel);
    }
  }

  onMapClick(event: google.maps.MapMouseEvent) {
    if (event.latLng) {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      this.selectedCoords = { lat, lng };
      this.addMarker(lat, lng, 'Siniestro reportado');
    }
  }

  addMarker(lat: number, lng: number, title: string, customIcon?: google.maps.Icon) {
    const newMarker: Marker = {
      id: Date.now(),
      lat,
      lng,
      title,
      icon: customIcon || this.defaultIcon
    };

    this.markers.push(newMarker);

    setTimeout(() => {
      this.map.googleMap?.setCenter({ lat, lng });
      this.map.googleMap?.setZoom(15);
    }, 50);
  }

  loadMarkers() {
    this.http
      .get<any[]>('https://weatheriadx-default-rtdb.firebaseio.com/flood_reports.json')
      .subscribe({
        next: (reports) => {
          if (!Array.isArray(reports)) {
            console.warn('No hay reportes en Firebase.');
            return;
          }

          const now = new Date();
          const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

          const validReports = reports.filter(
            (r: any) =>
              r.lat != null &&
              r.lng != null &&
              new Date(r.created_at) > cutoff
          );

          const manualMarkers = this.markers.filter(m =>
            m.icon.url.includes('red-dot')
          );

          const firebaseMarkers = validReports.map((r: any) => ({
            id: Date.now() + Math.random(),
            lat: r.lat,
            lng: r.lng,
            title: 'Inundación Reportada',
            icon: {
              url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
            }
          }));

          this.markers = [...manualMarkers, ...firebaseMarkers];
        },
        error: (err) => console.error('Error cargando flood_reports desde Firebase:', err)
      });
  }

  reportFlood() {
    if (this.isReporting) return;
    this.isReporting = true;

    const floodIcon: google.maps.Icon = {
      url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
    };

    if (this.selectedCoords) {
      const { lat, lng } = this.selectedCoords;
      const tempId = -Date.now();

      this.markers.push({
        id: tempId,
        lat,
        lng,
        title: 'Inundación Reportada',
        icon: floodIcon
      });

      this.sendReport(`GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, tempId);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const tempId = -Date.now();

        this.markers.push({
          id: tempId,
          lat,
          lng,
          title: 'Inundación Reportada',
          icon: floodIcon
        });

        this.sendReport(`GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, tempId);
      },
      () => this.addFallbackMarker(floodIcon),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  private addFallbackMarker(icon: google.maps.Icon) {
    const tempId = -Date.now();

    this.markers.push({
      id: tempId,
      lat: this.center.lat,
      lng: this.center.lng,
      title: 'Inundación Reportada',
      icon
    });

    this.sendReport(this.location, tempId);
  }

  private sendReport(userLocation: string, tempId?: number) {
    const payload = {
      mensaje: 'Se ha reportado una posible inundación desde el mapa.',
      ubicacion: userLocation,
      fecha: this.currentDate,
      temperatura: this.currentTemp,
      descripcion_clima: this.currentDescription
    };

    this.http.post(`${this.backendUrl}/report_flood`, payload).subscribe({
      next: () => alert('Reporte enviado.'),
      error: () => alert('No se pudo enviar el correo.'),
      complete: () => (this.isReporting = false)
    });

    if (this.selectedCoords) {
      const firebasePayload = {
        lat: this.selectedCoords.lat,
        lng: this.selectedCoords.lng,
        created_at: new Date().toISOString()
      };

      this.http
        .post(
          'https://weatheriadx-default-rtdb.firebaseio.com/flood_reports.json',
          firebasePayload
        )
        .subscribe();
    }
  }

  zoomIn() {
    this.zoomLevel++;
    this.map.googleMap?.setZoom(this.zoomLevel);
  }

  zoomOut() {
    this.zoomLevel--;
    this.map.googleMap?.setZoom(this.zoomLevel);
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  private updateCurrentDate() {
    const now = new Date();
    this.currentDate = now.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}
