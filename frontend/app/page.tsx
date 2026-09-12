'use client'

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">PersonOS</h1>
        <p className="text-xl text-gray-600 mb-8">
          Sistema integrado de gestão pessoal
        </p>
        <p className="text-gray-500 mb-8">
          Começando em breve... 🚀
        </p>
        <div className="space-y-4">
          <a
            href="/login"
            className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            Entrar
          </a>
          <p className="text-sm text-gray-600">
            ou faça o cadastro para começar
          </p>
        </div>
      </div>
    </main>
  )
}
