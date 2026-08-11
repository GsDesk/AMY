import React from "react";
import { Link } from "react-router-dom";
import { BackgroundLines } from "@/components/ui/background-lines";

export function HeroAMY() {
  return (
    <BackgroundLines className="flex items-center justify-center w-full flex-col px-4 py-20 bg-black">
      {/* Etiqueta Superior */}
      <span className="relative z-20 mb-4 px-3 py-1 text-xs font-mono tracking-wider uppercase text-neutral-400 bg-neutral-900 border border-neutral-800">
        UPEC / Ingeniería en Computación
      </span>

      {/* Título Principal (Color Sólido, Sin Gradientes) */}
      <h1 className="text-center text-white text-3xl md:text-5xl lg:text-6xl font-sans relative z-20 font-bold tracking-tight max-w-4xl leading-tight">
        Aprende Bases de Datos con <span className="text-purple-400">AMY</span>
      </h1>

      {/* Subtítulo / Descripción */}
      <p className="max-w-2xl mx-auto text-sm md:text-base text-neutral-400 text-center relative z-20 mt-6 leading-relaxed">
        Asistente inteligente que te guía con el método socrático para dominar SQL, normalización, modelo E-R y álgebra relacional. Sin respuestas directas, solo preguntas que te llevan a la solución.
      </p>

      {/* Botones de Acción Sólidos */}
      <div className="relative z-20 mt-8 flex flex-col sm:flex-row gap-4 items-center justify-center">
        <Link
          to="/login"
          className="px-6 py-3 bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition-colors text-center border-0 cursor-pointer"
        >
          Comenzar ahora &rarr;
        </Link>
        <a
          href="#features"
          className="px-6 py-3 bg-neutral-900 border border-neutral-800 text-neutral-300 font-medium text-sm hover:bg-neutral-800 transition-colors text-center"
        >
          Ver funcionalidades
        </a>
      </div>
    </BackgroundLines>
  );
}
