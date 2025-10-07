const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');
const Issue = require('../models/Issue');
const connectDB = require('../config/database');

const seedData = async () => {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Connect to database
    await connectDB();
    
    // Clear existing data
    console.log('🗑️ Clearing existing data...');
    await User.deleteMany({});
    await Issue.deleteMany({});
    
    // Create admin user
    console.log('👤 Creating admin user...');
    const adminUser = new User({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@anandmc.gov.in',
      phone: '+919876543210',
      password: 'Admin@123',
      role: 'admin',
      department: 'general',
      isVerified: true,
      address: {
        street: 'Municipal Corporation Building',
        area: 'City Center',
        city: 'Anand',
        state: 'Gujarat',
        pincode: '388001',
        coordinates: {
          latitude: 22.5645,
          longitude: 72.9289
        }
      }
    });
    
    await adminUser.save();
    console.log('✅ Admin user created');

    // Create department heads
    console.log('👥 Creating department heads...');
    const departments = [
      { name: 'roads', firstName: 'Rajesh', lastName: 'Patel', email: 'rajesh.patel@anandmc.gov.in' },
      { name: 'water', firstName: 'Priya', lastName: 'Shah', email: 'priya.shah@anandmc.gov.in' },
      { name: 'garbage', firstName: 'Amit', lastName: 'Desai', email: 'amit.desai@anandmc.gov.in' },
      { name: 'streetlights', firstName: 'Sunita', lastName: 'Joshi', email: 'sunita.joshi@anandmc.gov.in' },
      { name: 'drainage', firstName: 'Kiran', lastName: 'Mehta', email: 'kiran.mehta@anandmc.gov.in' },
      { name: 'parks', firstName: 'Deepak', lastName: 'Sharma', email: 'deepak.sharma@anandmc.gov.in' }
    ];

    const departmentHeads = [];
    for (const dept of departments) {
      const deptHead = new User({
        firstName: dept.firstName,
        lastName: dept.lastName,
        email: dept.email,
        phone: `+9198765432${Math.floor(Math.random() * 90) + 10}`,
        password: 'Dept@123',
        role: 'department_head',
        department: dept.name,
        isVerified: true,
        address: {
          city: 'Anand',
          state: 'Gujarat',
          coordinates: {
            latitude: 22.5645 + (Math.random() - 0.5) * 0.1,
            longitude: 72.9289 + (Math.random() - 0.5) * 0.1
          }
        }
      });
      
      await deptHead.save();
      departmentHeads.push(deptHead);
    }
    console.log('✅ Department heads created');

    // Create field officers
    console.log('👷 Creating field officers...');
    const fieldOfficers = [];
    for (let i = 0; i < 12; i++) {
      const names = [
        { first: 'Rahul', last: 'Kumar' },
        { first: 'Sneha', last: 'Patel' },
        { first: 'Vikram', last: 'Singh' },
        { first: 'Pooja', last: 'Gupta' },
        { first: 'Arjun', last: 'Yadav' },
        { first: 'Kavita', last: 'Nair' }
      ];
      
      const name = names[i % names.length];
      const deptName = departments[i % departments.length].name;
      
      const officer = new User({
        firstName: name.first,
        lastName: name.last,
        email: `${name.first.toLowerCase()}.${name.last.toLowerCase()}${i}@anandmc.gov.in`,
        phone: `+9198765432${String(i).padStart(2, '0')}`,
        password: 'Officer@123',
        role: 'field_officer',
        department: deptName,
        isVerified: true,
        address: {
          city: 'Anand',
          state: 'Gujarat',
          coordinates: {
            latitude: 22.5645 + (Math.random() - 0.5) * 0.1,
            longitude: 72.9289 + (Math.random() - 0.5) * 0.1
          }
        }
      });
      
      await officer.save();
      fieldOfficers.push(officer);
    }
    console.log('✅ Field officers created');

    // Create sample citizens
    console.log('👨‍👩‍👧‍👦 Creating sample citizens...');
    const citizenNames = [
      { first: 'Aarav', last: 'Patel' },
      { first: 'Diya', last: 'Shah' },
      { first: 'Arjun', last: 'Mehta' },
      { first: 'Riya', last: 'Desai' },
      { first: 'Karan', last: 'Joshi' },
      { first: 'Anaya', last: 'Sharma' },
      { first: 'Vivaan', last: 'Kumar' },
      { first: 'Saanvi', last: 'Singh' }
    ];

    const citizens = [];
    for (let i = 0; i < citizenNames.length; i++) {
      const name = citizenNames[i];
      
      const citizen = new User({
        firstName: name.first,
        lastName: name.last,
        email: `${name.first.toLowerCase()}.${name.last.toLowerCase()}@gmail.com`,
        phone: `+919876543${String(20 + i).padStart(3, '0')}`,
        password: 'Citizen@123',
        role: 'citizen',
        isVerified: true,
        address: {
          street: `Street ${i + 1}`,
          area: `Area ${String.fromCharCode(65 + (i % 5))}`,
          city: 'Anand',
          state: 'Gujarat',
          pincode: `38800${i % 9 + 1}`,
          coordinates: {
            latitude: 22.5645 + (Math.random() - 0.5) * 0.05,
            longitude: 72.9289 + (Math.random() - 0.5) * 0.05
          }
        },
        stats: {
          issuesReported: Math.floor(Math.random() * 10),
          contributionScore: Math.floor(Math.random() * 100)
        }
      });
      
      await citizen.save();
      citizens.push(citizen);
    }
    console.log('✅ Sample citizens created');

    // Create sample issues
    console.log('🚨 Creating sample issues...');
    const issueTemplates = [
      {
        category: 'roads',
        titles: ['Pothole on Main Road', 'Broken Road Surface', 'Road Crack Near School'],
        descriptions: [
          'Large pothole causing traffic issues and vehicle damage',
          'Road surface is broken and needs immediate repair',
          'Deep crack in the road near school area, safety concern for children'
        ]
      },
      {
        category: 'water',
        titles: ['Water Supply Disruption', 'Pipe Leakage', 'Low Water Pressure'],
        descriptions: [
          'No water supply for the past 3 days in our area',
          'Major pipe leakage causing water wastage and road flooding',
          'Very low water pressure, unable to fill tanks properly'
        ]
      },
      {
        category: 'garbage',
        titles: ['Garbage Not Collected', 'Overflowing Dustbin', 'Illegal Dumping'],
        descriptions: [
          'Garbage has not been collected for over a week',
          'Community dustbin is overflowing and creating hygiene issues',
          'People are dumping garbage illegally in the park area'
        ]
      },
      {
        category: 'streetlights',
        titles: ['Street Light Not Working', 'Flickering Street Light', 'No Street Lights'],
        descriptions: [
          'Street light has been non-functional for 2 weeks',
          'Street light keeps flickering, potential electrical hazard',
          'No street lights installed in the new residential area'
        ]
      },
      {
        category: 'drainage',
        titles: ['Blocked Drain', 'Stagnant Water', 'Broken Manhole Cover'],
        descriptions: [
          'Storm drain is completely blocked causing water logging',
          'Stagnant water creating mosquito breeding ground',
          'Manhole cover is broken and poses safety risk'
        ]
      },
      {
        category: 'parks',
        titles: ['Broken Playground Equipment', 'Park Maintenance Needed', 'No Security in Park'],
        descriptions: [
          'Children\'s swing is broken and unsafe to use',
          'Park needs general maintenance, overgrown vegetation',
          'Park lacks security lighting and guard, safety concern'
        ]
      }
    ];

    const statuses = ['submitted', 'acknowledged', 'in_progress', 'resolved'];
    const priorities = ['low', 'medium', 'high', 'critical'];

    for (let i = 0; i < 50; i++) {
      const template = issueTemplates[i % issueTemplates.length];
      const titleIndex = i % template.titles.length;
      const citizen = citizens[i % citizens.length];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const priority = priorities[Math.floor(Math.random() * priorities.length)];
      
      // Create random date within last 30 days
      const createdAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
      
      const issue = new Issue({
        title: template.titles[titleIndex],
        description: template.descriptions[titleIndex],
        category: template.category,
        priority,
        status,
        location: {
          coordinates: {
            latitude: citizen.address.coordinates.latitude + (Math.random() - 0.5) * 0.01,
            longitude: citizen.address.coordinates.longitude + (Math.random() - 0.5) * 0.01
          },
          address: {
            formatted: `${citizen.address.street}, ${citizen.address.area}, Anand, Gujarat`,
            street: citizen.address.street,
            area: citizen.address.area,
            city: 'Anand',
            state: 'Gujarat',
            pincode: citizen.address.pincode
          }
        },
        reportedBy: citizen._id,
        createdAt,
        views: Math.floor(Math.random() * 100),
        upvotes: Math.random() > 0.7 ? [{ user: citizens[Math.floor(Math.random() * citizens.length)]._id }] : []
      });

      // Add timeline entry
      issue.addTimelineEntry('created', 'Issue reported by citizen', citizen._id);
      
      // Add assignment for some issues
      if (status !== 'submitted') {
        const deptHead = departmentHeads.find(dh => dh.department === template.category);
        if (deptHead) {
          issue.assignIssue(deptHead._id, template.category, adminUser._id);
        }
      }
      
      // Add resolution for resolved issues
      if (status === 'resolved') {
        issue.actualResolutionTime = new Date(createdAt.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000);
        issue.resolutionNotes = 'Issue has been successfully resolved by our team.';
      }

      await issue.save();
    }
    
    console.log('✅ Sample issues created');

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   • 1 Admin user`);
    console.log(`   • ${departments.length} Department heads`);
    console.log(`   • ${fieldOfficers.length} Field officers`);
    console.log(`   • ${citizens.length} Citizens`);
    console.log(`   • 50 Sample issues`);
    
    console.log('\n🔐 Login Credentials:');
    console.log('   Admin: admin@anandmc.gov.in / Admin@123');
    console.log('   Citizen: aarav.patel@gmail.com / Citizen@123');
    console.log('   Dept Head: rajesh.patel@anandmc.gov.in / Dept@123');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

// Run seeding
if (require.main === module) {
  seedData();
}

module.exports = seedData;
