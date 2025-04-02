
const MeetingHistory = require('../../model/schema/meeting');
const User = require('../../model/schema/user');
const mongoose = require('mongoose');

const add = async (req, res) => {
    try {
    const result = new MeetingHistory(req.body);
    await result.save();
    res.status(200).json(result);
  } catch (err) {
    console.error('Failed to create meeting:', err);
    res.status(400).json({ err, error: 'Failed to create meeting' });
  }
};

const index = async (req, res) => {
  try {
    const query = req.query;
    query.deleted = false;

    const user = await User.findById(req.user.userId);
    if (user?.role !== 'superAdmin') {
      delete query.createBy;
      query.createBy = new mongoose.Types.ObjectId(req.user.userId);
    }

    const result = await MeetingHistory.aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'User',
          localField: 'createBy',
          foreignField: '_id',
          as: 'users'
        }
      },
      { $unwind: { path: '$users', preserveNullAndEmptyArrays: true } },
      { $match: { 'users.deleted': false } },
      {
        $addFields: {
          createdByName: { $concat: ['$users.firstName', ' ', '$users.lastName'] }
        }
      },
      {
        $project: {
          users: 0
        }
      }
    ]);

    res.status(200).json(result);
  } catch (err) {
    console.error('Failed to fetch meetings:', err);
    res.status(400).json({ err, error: 'Failed to fetch meetings' });
  }
};

const view = async (req, res) => {
    try {
        const meetingId = new mongoose.Types.ObjectId(req.params.id);

        const result = await MeetingHistory.findOne({ _id: meetingId });
    if (!result || result.deleted) {
        return res.status(404).json({ message: 'No Data Found.' });
    }

    const response = await MeetingHistory.aggregate([
        { $match: { _id: meetingId } },

        // Populate user who created the meeting
        {
        $lookup: {
            from: 'User',
            localField: 'createBy',
            foreignField: '_id',
            as: 'users',
        },
        },
        { $unwind: { path: '$users', preserveNullAndEmptyArrays: true } },
        { $match: { 'users.deleted': false } },

        {
        $addFields: {
            createdByName: {
            $concat: ['$users.firstName', ' ', '$users.lastName'],
            },
        },
        },

        // Populate contact attendees
        {
        $lookup: {
            from: 'Contacts',
            localField: 'attendes',
            foreignField: '_id',
            as: 'attendes',
        },
        },

        // Populate lead attendees
        {
        $lookup: {
            from: 'Leads',
            localField: 'attendesLead',
            foreignField: '_id',
            as: 'attendesLead',
        },
        },

        // Optional: remove raw user array
        {
        $project: {
            users: 0,
        },
        },
    ]);

        return res.status(200).json(response[0]);
    } catch (err) {
        console.error('Failed to fetch meeting:', err);
        return res.status(500).json({ error: 'Failed to fetch meeting', err });
    }
};

const deleteData = async (req, res) => {
    try {
        const meeting = await MeetingHistory.findByIdAndUpdate(req.params.id, { deleted: true }, { new: true });
        if (!meeting) {
        return res.status(404).json({ success: false, message: "Meeting not found" });
        }
        res.status(200).json({ success: true, message: "Meeting deleted successfully" });
    } catch (error) {
        console.error("Error deleting meeting:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
    };

    const deleteMany = async (req, res) => {
    try {
        let ids = [];

        // If frontend sends raw array (['id1', 'id2']), treat req.body directly as the array
        if (Array.isArray(req.body)) {
        ids = req.body;
        } else if (Array.isArray(req.body.ids)) {
        ids = req.body.ids;
        } else {
        return res.status(400).json({ success: false, message: "Invalid request format" });
        }

        await MeetingHistory.updateMany({ _id: { $in: ids } }, { deleted: true });
        res.status(200).json({ success: true, message: "Meetings deleted successfully" });
    } catch (error) {
        console.error("Error deleting meetings:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
};


module.exports = { add, index, view, deleteData, deleteMany };
