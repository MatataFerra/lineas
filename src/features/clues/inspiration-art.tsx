import Image, { type StaticImageData } from "next/image";
import carta from "./banner/carta.webp";
import grabado from "./banner/grabado.webp";

/**
 * La franja del costado de la home: una ilustración fija, en grabado.
 *
 * Hay dos y se elige a mano con LINEAS_BANNER en .env.local (grabado | carta);
 * sin la variable, o con un valor desconocido, va el grabado. Se lee al
 * renderizar en el servidor: el cambio aparece al reiniciar `next dev` o en el
 * próximo build.
 *
 * - grabado: del libro abierto sale el camino, entre Rayuela, Nantucket,
 *   La Mancha y la selva oscura, hasta el Olimpo bajo el sol.
 * - carta: un portulano; del muelle sale la estela y la nave sigue uno de los
 *   rumbos hasta el faro.
 */
const BANNERS = { grabado, carta } satisfies Record<string, StaticImageData>;

type BannerName = keyof typeof BANNERS;

function isBannerName(value: string | undefined): value is BannerName {
  return value !== undefined && Object.hasOwn(BANNERS, value);
}

export function InspirationArt() {
  const name = process.env.LINEAS_BANNER;
  const banner = BANNERS[isBannerName(name) ? name : "grabado"];

  return (
    <div className="relative hidden max-w-[260px] flex-[0_0_18%] overflow-hidden md:block" aria-hidden="true">
      {/* Anclada abajo: en pantallas bajas se recorta el cielo, nunca el punto de partida. */}
      <Image src={banner} alt="" fill loading="eager" sizes="(min-width: 768px) 260px, 1px" className="object-cover object-bottom" />
    </div>
  );
}
