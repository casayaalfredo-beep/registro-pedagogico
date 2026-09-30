import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, File as FileIcon, FileText, Image as ImageIcon, Trash2, Download, Archive } from 'lucide-react';
import api from '../api';

const RepositorioModal = ({ isOpen, onClose, config }) => {
    const [trimestre, setTrimestre] = useState(1);
    const [archivos, setArchivos] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (isOpen && config?.id) {
            fetchArchivos();
        }
    }, [isOpen, trimestre, config]);

    const fetchArchivos = () => {
        if (!config?.id) return;
        api.get(`/repositorio/${config.id}/${trimestre}`)
            .then(res => setArchivos(res.data))
            .catch(err => console.error(err));
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('configId', config.id);
        formData.append('trimestre', trimestre);

        setIsUploading(true);
        try {
            await api.post('/repositorio/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            fetchArchivos();
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (error) {
            console.error('Error uploading:', error);
            alert('Error al subir el archivo');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Estás seguro de eliminar este archivo permanentemente?')) return;
        try {
            await api.delete(`/repositorio/${id}`);
            fetchArchivos();
        } catch (error) {
            console.error('Error deleting:', error);
            alert('Error al eliminar');
        }
    };

    const handleDownload = async (id, fileName) => {
        try {
            // Se utiliza la instancia api (axios) para que incluya automáticamente el token JWT
            const response = await api.get(`/repositorio/download/${id}`, {
                responseType: 'blob' // Importante para manejar archivos binarios
            });
            
            // Crear una URL temporal para el blob
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            
            // Limpiar
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading:', error);
            alert('Error al descargar el archivo. Compruebe la conexión o su sesión.');
        }
    };

    const getFileIcon = (mimeType, fileName) => {
        if (mimeType.includes('pdf')) return <FileText className="text-red-500" size={24} />;
        if (mimeType.includes('image')) return <ImageIcon className="text-blue-500" size={24} />;
        if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) return <Archive className="text-green-500" size={24} />;
        if (mimeType.includes('word') || fileName.endsWith('.doc') || fileName.endsWith('.docx')) return <FileText className="text-blue-700" size={24} />;
        return <FileIcon className="text-slate-500" size={24} />;
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateString) => {
        const d = new Date(dateString);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-teal-50 to-emerald-50">
                    <div className="flex items-center space-x-3">
                        <div className="bg-teal-500 text-white p-2 rounded-xl">
                            <Archive size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Repositorio de Archivos</h2>
                            <p className="text-xs text-slate-500 font-medium">Archivos guardados para el trimestre seleccionado</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500 hover:text-slate-700"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-auto flex flex-col gap-6">
                    {/* Controls */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                            {[1, 2, 3].map(t => (
                                <button
                                    key={t}
                                    onClick={() => setTrimestre(t)}
                                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                                        trimestre === t 
                                        ? 'bg-white shadow text-teal-600' 
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                    }`}
                                >
                                    {t}º Trimestre
                                </button>
                            ))}
                        </div>

                        <div>
                            <input 
                                type="file" 
                                ref={fileInputRef}
                                className="hidden" 
                                onChange={handleFileUpload} 
                            />
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center space-x-2 transition shadow-lg shadow-teal-200 hover:-translate-y-0.5 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                <Upload size={18} />
                                <span>{isUploading ? 'Subiendo...' : 'Subir Archivo'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Files Table */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex-1">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-xs">
                                    <tr>
                                        <th className="py-3 px-4 w-10"></th>
                                        <th className="py-3 px-4">Nombre del Archivo</th>
                                        <th className="py-3 px-4">Tamaño</th>
                                        <th className="py-3 px-4">Fecha</th>
                                        <th className="py-3 px-4 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {archivos.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="py-12 text-center text-slate-400">
                                                <div className="flex flex-col items-center justify-center space-y-3">
                                                    <Archive size={40} className="opacity-20" />
                                                    <p>No hay archivos en este trimestre.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        archivos.map(archivo => (
                                            <tr key={archivo.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="py-3 px-4">
                                                    {getFileIcon(archivo.mimeType, archivo.fileName)}
                                                </td>
                                                <td className="py-3 px-4 font-medium text-slate-800 break-all max-w-[200px]">
                                                    {archivo.originalName}
                                                </td>
                                                <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                                                    {formatSize(archivo.size)}
                                                </td>
                                                <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                                                    {formatDate(archivo.createdAt)}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center justify-center space-x-2">
                                                        <button 
                                                            onClick={() => handleDownload(archivo.id, archivo.originalName)}
                                                            className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                                            title="Descargar"
                                                        >
                                                            <Download size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDelete(archivo.id)}
                                                            className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RepositorioModal;
