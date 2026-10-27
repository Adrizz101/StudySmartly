import { lazy, Suspense } from 'react';
import { ClientOnly } from '@tanstack/react-router';
const DrawingBoard=lazy(()=>import('./DrawingBoard'));
export default function Whiteboard(){return <ClientOnly fallback={<p>Opening whiteboard…</p>}><Suspense fallback={<p>Opening whiteboard…</p>}><DrawingBoard/></Suspense></ClientOnly>;}