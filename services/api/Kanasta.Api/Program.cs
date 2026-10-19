using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using Kanasta.Api.Middlewares;
using Kanasta.Application.Abstractions;
using Kanasta.Infrastructure.Persistence;
using Kanasta.Infrastructure.Persistence.Seed;
using Kanasta.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// 1. Database Configuration
var dbProvider = builder.Configuration["DatabaseProvider"] ?? "PostgreSQL";
var defaultConn = builder.Configuration.GetConnectionString("DefaultConnection");
var sqliteConn = builder.Configuration.GetConnectionString("SqliteConnection") ?? "Data Source=kanasta_dev.db";

builder.Services.AddDbContext<KanastaDbContext>(options =>
{
    bool usePostgres = dbProvider.Equals("PostgreSQL", StringComparison.OrdinalIgnoreCase);

    if (dbProvider.Equals("Auto", StringComparison.OrdinalIgnoreCase))
    {
        // En modo Auto (desarrollo): verificar si PostgreSQL es alcanzable rápidamente
        try
        {
            using var tcpClient = new System.Net.Sockets.TcpClient();
            var result = tcpClient.BeginConnect("localhost", 5432, null, null);
            var success = result.AsyncWaitHandle.WaitOne(TimeSpan.FromMilliseconds(400));
            usePostgres = success && tcpClient.Connected;
        }
        catch
        {
            usePostgres = false;
        }
    }

    if (usePostgres)
    {
        options.UseNpgsql(defaultConn).UseSnakeCaseNamingConvention();
    }
    else
    {
        options.UseSqlite(sqliteConn).UseSnakeCaseNamingConvention();
    }
});

// 2. Application & Infrastructure Services
builder.Services.AddScoped<IPasswordHasher, BcryptPasswordHasher>();
builder.Services.AddScoped<ITokenService, JwtTokenService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IUserAdminService, UserAdminService>();
builder.Services.AddScoped<ICategoryService, CategoryService>();
builder.Services.AddScoped<IProductService, ProductService>();
builder.Services.AddScoped<ITaxRateService, TaxRateService>();
builder.Services.AddScoped<ISupplierService, SupplierService>();
builder.Services.AddScoped<IPurchaseService, PurchaseService>();
builder.Services.AddScoped<IInventoryService, InventoryService>();
builder.Services.AddScoped<ISaleService, SaleService>();
builder.Services.AddScoped<IReportService, ReportService>();

// 3. Authentication & JWT Bearer
var jwtSecret = builder.Configuration["Jwt:Secret"] 
                ?? "kanasta_dev_jwt_secret_key_minimum_32_characters_long_super_secure!";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "KanastaApi";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "KanastaDesktop";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        RoleClaimType = ClaimTypes.Role,
        NameClaimType = ClaimTypes.Name
    };
});

builder.Services.AddAuthorization();

// 4. Rate Limiting for Security Hardening (Brute-force protection on auth)
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddFixedWindowLimiter("AuthLimiter", opt =>
    {
        opt.PermitLimit = 15;
        opt.Window = TimeSpan.FromSeconds(30);
        opt.QueueProcessingOrder = System.Threading.RateLimiting.QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 0;
    });
});

// 5. CORS for Desktop (Vite & Tauri 2)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowDesktopApp", policy =>
    {
        policy.WithOrigins(
            "http://localhost:5173", 
            "http://127.0.0.1:5173", 
            "tauri://localhost", 
            "https://tauri.localhost")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// 6. Controllers & Swagger
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Kanasta POS API",
        Version = "v2.0",
        Description = "API REST de alto rendimiento para Kanasta POS — Sistema integral de Punto de Venta (POS), Inventario Multimoneda (VES/USD con tasa oficial BCV), Compras, Proveedores, Kardex y Arqueo de Caja para Abastos y Comercios.",
        Contact = new OpenApiContact
        {
            Name = "Kanasta POS Engineering Team",
            Email = "contacto@kanasta.local"
        }
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header usando el esquema Bearer. Ejemplo: \"Bearer {token}\"",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// Auto-seed in Development
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<KanastaDbContext>();
    db.Database.EnsureCreated();
    DatabaseSeeder.Seed(db);
}

// Pipeline: Security & Exception Shielding First
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Kanasta POS API v1");
    });
}

app.UseRateLimiter();
app.UseCors("AllowDesktopApp");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
