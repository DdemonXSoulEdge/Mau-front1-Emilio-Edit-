import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';

interface HourlyWeather {
  day: string;
  icon: string;
  temp: string;
}

type WeatherState = 'night' | 'cloudy' | 'rainy' | 'sunny';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './home.html',
  styleUrls: ['./home.scss']
})
export class HomeComponent implements OnInit {
  showMenu = false;

  currentDate = '';
  currentTemp = '— °C';
  location = 'Estación - Universidad Tecnológica de Querétaro';
  currentWeatherState: WeatherState = 'sunny';

  weatherDescriptions: Record<WeatherState, string> = {
    night: 'Noche despejada, sin riesgo de lluvia.',
    cloudy: 'Cielo parcialmente cubierto o neblina matutina.',
    rainy: 'Lluvias moderadas, mantén precaución al conducir.',
    sunny: 'Cielos despejados y temperaturas agradables.'
  };

  mainWeatherIcons: Record<WeatherState, string> = {
    night: '🌙',
    cloudy: '🌥️',
    rainy: '🌧️',
    sunny: '☀️'
  };

  hourlyForecast: HourlyWeather[] = [];

  constructor(private router: Router, private http: HttpClient) {}

  ngOnInit() {
    this.updateCurrentDate();
    this.loadWeatherData();        // carga registros.json y configura temperatura/estado
    this.loadPronosticoDias();     // carga pronostico_lluvia_queretaro.json y rellena hourlyForecast (días)
  }

  /** Fecha en español */
  private updateCurrentDate(): void {
    const now = new Date();
    this.currentDate = now.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  private loadWeatherData(): void {
    this.http.get<any[]>('WeatheriaBackend/weatheria/registros.json').subscribe({
      next: (data) => {
        if (data && data.length > 0) {
          const registro = data[data.length - 1]; // último registro
          this.currentTemp = `${registro.temp} °C`;
          this.currentWeatherState = this.getWeatherState(registro);
          // NOTA: no tocamos hourlyForecast aquí (se llena desde pronóstico de días)
        } else {
          console.warn('No hay datos disponibles en registros.json.');
        }
      },
      error: (err) => {
        console.error('Error al cargar registros.json:', err);
      }
    });
  }

  /** Lógica día/noche y estado del clima basada en registro */
  private getWeatherState(registro: any): WeatherState {
    const hora = new Date().getHours();
    // Noche: 20:00 - 05:59
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

  
private loadPronosticoDias(): void {
  this.http.get<any[]>('WeatheriaBackend/weatheria/pronostico_lluvia_queretaro.json').subscribe({
    next: (data) => {
      if (!Array.isArray(data) || data.length === 0) {
        console.warn('Pronostico_lluvia_queretaro.json vacío o no es un arreglo.');
        this.hourlyForecast = [];
        return;
      }

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      // ⚙️ Convertir manualmente las fechas del JSON a hora local (evita desfase UTC)
      const pronosticosValidos = data
        .map((dia) => {
          const [year, month, day] = dia.fecha.split('-').map(Number);
          const fechaLocal = new Date(year, month - 1, day, 0, 0, 0); // <-- local time
          return { ...dia, fechaObj: fechaLocal };
        })
        .filter((d) => !isNaN(d.fechaObj.getTime()) && d.fechaObj >= hoy)
        .sort((a, b) => a.fechaObj.getTime() - b.fechaObj.getTime());

      if (pronosticosValidos.length === 0) {
        console.warn('No hay pronósticos válidos para hoy o días futuros.');
        this.hourlyForecast = [];
        return;
      }

      this.hourlyForecast = pronosticosValidos.map((dia) => {
        const dayName = dia.fechaObj.toLocaleDateString('es-ES', { weekday: 'short' }); // ej "mié"

        let icon = '☁️';
        if (dia.llovera_modelo === 1 || dia.llovera_modelo === true) {
          icon = '🌧️';
        } else {
          const condicion = (dia.condicion || '').toString().toLowerCase();
          if (condicion.includes('sunny') || condicion.includes('soleado')) {
            icon = '☀️';
          } else {
            icon = '☁️';
          }
        }

        const tempLabel = (typeof dia.prob_lluvia_api === 'number')
          ? `${dia.prob_lluvia_api}%`
          : '—';

        return {
          day: dayName.charAt(0).toUpperCase() + dayName.slice(1),
          icon,
          temp: tempLabel
        } as HourlyWeather;
      });
    },
    error: (err) => {
      console.error('Error al cargar pronostico_lluvia_queretaro.json:', err);
      this.hourlyForecast = [];
    }
  });
}


  /** Envía reporte de inundación (mantengo como antes) */
  reportFlood() {
    const payload = {
      ubicacion: this.location,
      fecha: this.currentDate,
      temperatura: this.currentTemp,
      descripcion_clima: this.currentDescription,
      mensaje: 'Se ha reportado una posible inundación en la zona. Verificar inmediatamente.'
    };

    console.log('Payload enviado:', payload);

    // Si tienes backend, descomenta y ajusta la URL:
    this.http.post('https://login-spe2.onrender.com/report_flood', payload);
  }

  get currentDescription(): string {
    return this.weatherDescriptions[this.currentWeatherState];
  }

  get mainIcon(): string {
    return this.mainWeatherIcons[this.currentWeatherState];
  }

  toggleMenu() {
    this.showMenu = !this.showMenu;
  }

  goToMapa() {
    this.router.navigate(['/mapa']);
    this.showMenu = false;
  }

  goToLogin() {
    this.router.navigate(['/login']);
    this.showMenu = false;
  }
}
